import "server-only";
import { adminDb } from "./firebase-admin";
import type { AttendanceDoc, Batch, Exam, ExamState, Notice, Payment, Student, Submission } from "./types";
import { dhakaDate, dhakaMonth, examEndsAt, examState, round2, seededShuffle } from "./utils";

export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await adminDb().collection("exams").doc(examId).get();
  return snap.exists ? ({ ...(snap.data() as Omit<Exam, "id">), id: snap.id }) : null;
}

export async function getSubmission(examId: string, studentId: string): Promise<Submission | null> {
  const snap = await adminDb().collection("exams").doc(examId).collection("submissions").doc(studentId).get();
  return snap.exists ? (snap.data() as Submission) : null;
}

/** Rank = 1 + number of students who scored strictly higher. */
export async function getRank(examId: string, score: number): Promise<{ rank: number; outOf: number }> {
  const subs = adminDb().collection("exams").doc(examId).collection("submissions");
  const [higher, total] = await Promise.all([
    subs.where("score", ">", score).count().get(),
    subs.count().get(),
  ]);
  return { rank: higher.data().count + 1, outOf: total.data().count };
}

export function gradeAnswers(exam: Exam, answers: Record<string, number>) {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const clean: Record<string, number> = {};
  for (const q of exam.questions) {
    const a = answers[q.id];
    if (typeof a !== "number" || a < 0 || a >= q.options.length) {
      skipped++;
      continue;
    }
    clean[q.id] = a;
    if (a === q.answer) correct++;
    else wrong++;
  }
  const score = round2(correct * exam.marksPerQuestion - wrong * exam.negativeMark);
  return { correct, wrong, skipped, score, answers: clean };
}

/** The question paper a student sees: per-student shuffled order, options shuffled, no answers. */
export function paperFor(exam: Exam, studentId: string) {
  const seed = `${exam.id}:${studentId}`;
  return seededShuffle(exam.questions, seed).map((q) => ({
    id: q.id,
    text: q.text,
    options: seededShuffle(
      q.options.map((text, i) => ({ i, text })),
      `${seed}:${q.id}`
    ),
  }));
}

export interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  startAt: number;
  endsAt: number;
  durationMin: number;
  totalMarks: number;
  questionCount: number;
  negativeMark: number;
  state: ExamState;
  submitted: boolean;
  score?: number;
}

export interface StudentSummary {
  student: { id: string; name: string; roll: string; batchName: string };
  exams: ExamListItem[];
  latestResult: null | { examId: string; title: string; subject: string; score: number; totalMarks: number; rank: number; outOf: number };
  weakChapters: { chapter: string; correct: number; total: number; percent: number }[];
  attendance: { date: string; status: "P" | "A" }[];
  fee: { month: string; amount: number; paid: number; status: "Paid" | "Partial" | "Due" };
  notices: { id: string; title: string; message: string; createdAt: number }[];
}

export async function buildStudentSummary(student: Student): Promise<StudentSummary> {
  const db = adminDb();
  const now = Date.now();

  const [batchSnap, examSnap, noticeSnap, paymentSnap] = await Promise.all([
    db.collection("batches").doc(student.batchId).get(),
    db.collection("exams").where("batchId", "==", student.batchId).get(),
    db.collection("notices").where("batchIds", "array-contains-any", [student.batchId, "all"]).get(),
    db.collection("payments").where("studentId", "==", student.id).get(),
  ]);
  const batch = batchSnap.exists ? (batchSnap.data() as Batch) : null;

  const exams = examSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Exam, "id">), id: d.id }))
    .sort((a, b) => b.startAt - a.startAt);

  // My submissions for every exam in my batch
  const subs = await Promise.all(exams.map((e) => getSubmission(e.id, student.id)));

  const examItems: ExamListItem[] = exams.map((e, i) => ({
    id: e.id,
    title: e.title,
    subject: e.subject,
    startAt: e.startAt,
    endsAt: examEndsAt(e),
    durationMin: e.durationMin,
    totalMarks: e.totalMarks,
    questionCount: e.questions.length,
    negativeMark: e.negativeMark,
    state: examState(e, now),
    submitted: !!subs[i],
    score: subs[i]?.score,
  }));

  // Latest finished exam I sat
  let latestResult: StudentSummary["latestResult"] = null;
  const latestIdx = exams.findIndex((e, i) => subs[i] && examState(e, now) === "ended");
  if (latestIdx >= 0) {
    const e = exams[latestIdx];
    const s = subs[latestIdx]!;
    const { rank, outOf } = await getRank(e.id, s.score);
    latestResult = { examId: e.id, title: e.title, subject: e.subject, score: s.score, totalMarks: e.totalMarks, rank, outOf };
  }

  // Weak chapters from all finished exams
  const chapterStats = new Map<string, { correct: number; total: number }>();
  exams.forEach((e, i) => {
    const s = subs[i];
    if (!s || examState(e, now) !== "ended") return;
    for (const q of e.questions) {
      const st = chapterStats.get(q.chapter) || { correct: 0, total: 0 };
      st.total++;
      if (s.answers[q.id] === q.answer) st.correct++;
      chapterStats.set(q.chapter, st);
    }
  });
  const weakChapters = [...chapterStats.entries()]
    .map(([chapter, st]) => ({ chapter, ...st, percent: Math.round((st.correct / st.total) * 100) }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 5);

  // Attendance over the last 7 days (only days the batch had class)
  const days = Array.from({ length: 7 }, (_, k) => dhakaDate(now - (6 - k) * 86400000));
  const attRefs = days.map((d) => db.collection("attendance").doc(`${student.batchId}_${d}`));
  const attSnaps = await db.getAll(...attRefs);
  const attendance = attSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as AttendanceDoc)
    .filter((a) => a.records[student.id])
    .map((a) => ({ date: a.date, status: a.records[student.id] }));

  // This month's fee
  const month = dhakaMonth(now);
  const paid = paymentSnap.docs
    .map((d) => d.data() as Payment)
    .filter((p) => p.month === month)
    .reduce((sum, p) => sum + p.amount, 0);
  const amount = batch?.fee || 0;
  const status = paid >= amount ? "Paid" : paid > 0 ? "Partial" : "Due";

  const notices = noticeSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Notice, "id">), id: d.id }))
    .filter((n) => n.viaApp)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((n) => ({ id: n.id, title: n.title, message: n.message, createdAt: n.createdAt }));

  return {
    student: { id: student.id, name: student.name, roll: student.roll, batchName: batch?.name || "" },
    exams: examItems,
    latestResult,
    weakChapters,
    attendance,
    fee: { month, amount, paid, status },
    notices,
  };
}

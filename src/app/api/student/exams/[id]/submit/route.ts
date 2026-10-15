import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError, handle, requireStudent } from "@/lib/api-auth";
import { SUBMIT_GRACE_SECONDS } from "@/lib/config";
import { adminDb } from "@/lib/firebase-admin";
import { getExam, gradeAnswers } from "@/lib/exam-server";
import type { Submission } from "@/lib/types";
import { examEndsAt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const student = await requireStudent(req);
  const exam = await getExam(id);
  if (!exam || exam.batchId !== student.batchId) throw new HttpError(404, "Exam not found");

  const now = Date.now();
  if (now < exam.startAt) throw new HttpError(400, "This exam hasn't started yet");
  if (now > examEndsAt(exam) + SUBMIT_GRACE_SECONDS * 1000) throw new HttpError(400, "Time is over for this exam");

  const body = (await req.json()) as { answers?: Record<string, number>; tabSwitches?: number };
  const graded = gradeAnswers(exam, body.answers || {});

  const db = adminDb();
  const examRef = db.collection("exams").doc(exam.id);
  const subRef = examRef.collection("submissions").doc(student.id);

  const submission: Submission = {
    studentId: student.id,
    studentName: student.name,
    roll: student.roll,
    answers: graded.answers,
    correct: graded.correct,
    wrong: graded.wrong,
    skipped: graded.skipped,
    score: graded.score,
    tabSwitches: Math.max(0, Math.min(999, Number(body.tabSwitches) || 0)),
    submittedAt: now,
  };

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(subRef);
    if (existing.exists) throw new HttpError(409, "You have already submitted this exam");
    tx.set(subRef, submission);
    tx.update(examRef, {
      submittedCount: FieldValue.increment(1),
      scoreSum: FieldValue.increment(graded.score),
    });
  });

  return NextResponse.json({
    score: graded.score,
    correct: graded.correct,
    wrong: graded.wrong,
    skipped: graded.skipped,
  });
});

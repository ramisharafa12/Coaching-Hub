import { NextResponse } from "next/server";
import { HttpError, handle, requireStudent } from "@/lib/api-auth";
import { getExam, getRank, getSubmission, paperFor } from "@/lib/exam-server";
import { examEndsAt, examState, solutionsAt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const student = await requireStudent(req);
  const exam = await getExam(id);
  if (!exam || exam.batchId !== student.batchId) throw new HttpError(404, "Exam not found");

  const now = Date.now();
  const state = examState(exam, now);
  const endsAt = examEndsAt(exam);
  const revealAt = solutionsAt(exam);
  const meta = {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    startAt: exam.startAt,
    endsAt,
    revealAt,
    durationMin: exam.durationMin,
    marksPerQuestion: exam.marksPerQuestion,
    negativeMark: exam.negativeMark,
    totalMarks: exam.totalMarks,
    questionCount: exam.questions.length,
    serverNow: now,
  };

  if (state === "scheduled") {
    return NextResponse.json({ state, exam: meta });
  }

  const submission = await getSubmission(exam.id, student.id);

  // Until the late-submit grace window closes, the answer key never leaves the server:
  // late submissions are still accepted then, so showing it would let anyone copy it in.
  if (now < revealAt) {
    if (submission) {
      // Score is instant, but answers stay hidden until everyone has finished.
      return NextResponse.json({
        state: "submitted",
        exam: meta,
        result: { score: submission.score, correct: submission.correct, wrong: submission.wrong, skipped: submission.skipped },
      });
    }
    if (state === "live") {
      return NextResponse.json({ state, exam: meta, paper: paperFor(exam, student.id) });
    }
    // Time is up but the grace window is open: a device with saved answers can still send them.
    return NextResponse.json({ state: "closing", exam: meta });
  }

  // Ended: full solutions.
  const rank = submission ? await getRank(exam.id, submission.score) : null;
  return NextResponse.json({
    state: "ended",
    exam: meta,
    result: submission
      ? { score: submission.score, correct: submission.correct, wrong: submission.wrong, skipped: submission.skipped, ...rank }
      : null,
    solutions: exam.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation || "",
      chapter: q.chapter,
      chosen: submission ? submission.answers[q.id] ?? null : null,
    })),
  });
});

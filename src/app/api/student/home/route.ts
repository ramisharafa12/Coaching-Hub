import { NextResponse } from "next/server";
import { handle, requireStudent } from "@/lib/api-auth";
import { buildStudentSummary } from "@/lib/exam-server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const student = await requireStudent(req);
  return NextResponse.json(await buildStudentSummary(student));
});

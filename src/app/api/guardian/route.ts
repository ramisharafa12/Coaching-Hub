import { NextResponse } from "next/server";
import { HttpError, handle, resolveIdentity, verifyRequest } from "@/lib/api-auth";
import { buildStudentSummary } from "@/lib/exam-server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "guardian" || !id.children?.length) throw new HttpError(403, "Guardians only");
  const children = await Promise.all(id.children.map((s) => buildStudentSummary(s)));
  return NextResponse.json({ children });
});

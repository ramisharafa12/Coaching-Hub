import { NextResponse } from "next/server";
import { HttpError, handle, resolveIdentity, verifyRequest } from "@/lib/api-auth";
import { demoPaymentsEnabled } from "@/lib/config";
import { buildStudentSummary } from "@/lib/exam-server";
import { messagesFor } from "@/lib/messages";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "guardian" || !id.children?.length || !id.phone) throw new HttpError(403, "Guardians only");
  const [children, messages] = await Promise.all([Promise.all(id.children.map((s) => buildStudentSummary(s))), messagesFor(id.phone)]);
  return NextResponse.json({ children, messages, demoPayments: demoPaymentsEnabled() });
});

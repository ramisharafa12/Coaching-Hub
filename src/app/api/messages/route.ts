import { NextResponse } from "next/server";
import { HttpError, handle, requireStaff } from "@/lib/api-auth";
import { postMessages } from "@/lib/messages";
import type { GuardianMessage } from "@/lib/types";
import { normalizeBdPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KINDS: GuardianMessage["kind"][] = ["absent", "result", "fee", "notice", "manual"];

interface Body {
  kind?: string;
  messages?: { phone: string; message: string; studentId?: string }[];
}

/** Staff send messages to guardians' in-app inbox (free — replaces SMS). */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  const body = (await req.json()) as Body;
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!raw.length) throw new HttpError(400, "No messages");
  if (raw.length > 1000) throw new HttpError(400, "Too many messages in one request (max 1000)");

  const messages = raw
    .map((m) => ({
      phone: normalizeBdPhone(m.phone),
      message: String(m.message || "").slice(0, 1000),
      studentId: typeof m.studentId === "string" ? m.studentId : undefined,
    }))
    .filter((m) => m.phone && m.message);
  if (!messages.length) throw new HttpError(400, "No valid phone numbers");

  const kind = KINDS.includes(body.kind as GuardianMessage["kind"]) ? (body.kind as GuardianMessage["kind"]) : "manual";
  const result = await postMessages(messages, staff.email || staff.uid, kind);
  return NextResponse.json(result);
});

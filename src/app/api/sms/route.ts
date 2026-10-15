import { NextResponse } from "next/server";
import { HttpError, handle, requireStaff } from "@/lib/api-auth";
import { sendSms } from "@/lib/sms";
import { normalizeBdPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Body {
  kind?: string;
  messages?: { phone: string; message: string }[];
}

export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req);
  const body = (await req.json()) as Body;
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!raw.length) throw new HttpError(400, "No messages");
  if (raw.length > 1000) throw new HttpError(400, "Too many messages in one request (max 1000)");

  const messages = raw
    .map((m) => ({ phone: normalizeBdPhone(m.phone), message: String(m.message || "").slice(0, 640) }))
    .filter((m) => m.phone && m.message);
  if (!messages.length) throw new HttpError(400, "No valid phone numbers");

  const result = await sendSms(messages, staff.email || staff.uid, body.kind || "manual");
  return NextResponse.json(result);
});

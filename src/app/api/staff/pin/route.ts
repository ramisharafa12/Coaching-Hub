import { NextResponse } from "next/server";
import { HttpError, handle, isRegisteredPhone, requireStaff } from "@/lib/api-auth";
import { setNewPin } from "@/lib/pin";
import { normalizeBdPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Staff give a student or guardian number a new login PIN. It is returned once, never stored readable. */
export const POST = handle(async (req: Request) => {
  await requireStaff(req);
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = normalizeBdPhone(body.phone);
  if (!phone) throw new HttpError(400, "Invalid phone number");
  if (!(await isRegisteredPhone(phone))) throw new HttpError(404, "No student or guardian has this number");
  const pin = await setNewPin(phone);
  return NextResponse.json({ phone, pin });
});

import { NextResponse } from "next/server";
import { HttpError, PHONE_CLAIM, handle, isRegisteredPhone } from "@/lib/api-auth";
import { adminAuth } from "@/lib/firebase-admin";
import { LOCK_MINUTES, PIN_LENGTH, checkPin, phoneUid } from "@/lib/pin";
import { normalizeBdPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

// One message for an unknown number, a missing PIN and a wrong PIN, so the form
// can't be used to find out which numbers belong to students.
const WRONG = "Wrong number or PIN. If you don't have a PIN yet, ask your coaching center.";

/** Student / guardian login: phone + PIN in, Firebase custom token out. */
export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; pin?: string };
  const phone = normalizeBdPhone(body.phone);
  const pin = String(body.pin || "").replace(/\D/g, "");
  if (!phone || pin.length !== PIN_LENGTH) throw new HttpError(400, `Enter your mobile number and ${PIN_LENGTH}-digit PIN.`);

  if (!(await isRegisteredPhone(phone))) throw new HttpError(401, WRONG);
  const result = await checkPin(phone, pin);
  if (result === "locked") throw new HttpError(429, `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.`);
  if (result !== "ok") throw new HttpError(401, WRONG);

  const token = await adminAuth().createCustomToken(phoneUid(phone), { [PHONE_CLAIM]: phone });
  return NextResponse.json({ token });
});

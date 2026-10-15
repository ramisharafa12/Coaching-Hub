import "server-only";
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { adminAuth, adminDb } from "./firebase-admin";

// Students and guardians log in with their phone number + a 6-digit PIN the center gives them.
// It replaces SMS OTP, which costs money per message. PINs are stored only as scrypt hashes in
// phoneLogins/{e164}, which the Firestore rules keep away from every browser.

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const PIN_LENGTH = 6;
const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

interface PhoneLogin {
  pinHash: string; // base64 scrypt
  salt: string; // base64
  failed: number; // wrong attempts since the last success or lock
  lockedUntil: number; // epoch ms
  updatedAt: number;
}

/** Firebase uid for a phone login — stable, so one number always maps to one account. */
export function phoneUid(e164: string): string {
  return "p_" + e164.replace(/\D/g, "");
}

/** Creates (or replaces) the PIN for a number and returns it. It can't be read back later. */
export async function setNewPin(phone: string): Promise<string> {
  const pin = String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  const doc: PhoneLogin = {
    pinHash: hash.toString("base64"),
    salt: salt.toString("base64"),
    failed: 0,
    lockedUntil: 0,
    updatedAt: Date.now(),
  };
  await adminDb().collection("phoneLogins").doc(phone).set(doc);
  // Sign out any device still signed in with the old PIN (no account yet is fine).
  await adminAuth()
    .revokeRefreshTokens(phoneUid(phone))
    .catch(() => undefined);
  return pin;
}

export type PinCheck = "ok" | "wrong" | "locked" | "no_pin";

/** Checks a PIN, counting wrong attempts; the fifth wrong one locks the number for a while. */
export async function checkPin(phone: string, pin: string): Promise<PinCheck> {
  const db = adminDb();
  const ref = db.collection("phoneLogins").doc(phone);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "no_pin";
    const d = snap.data() as PhoneLogin;
    const now = Date.now();
    if (d.lockedUntil > now) return "locked";

    const hash = await scrypt(pin, Buffer.from(d.salt, "base64"), 32);
    const stored = Buffer.from(d.pinHash, "base64");
    if (stored.length === hash.length && timingSafeEqual(hash, stored)) {
      if (d.failed) tx.update(ref, { failed: 0 });
      return "ok";
    }

    const failed = (d.failed || 0) + 1;
    if (failed >= MAX_FAILS) {
      tx.update(ref, { failed: 0, lockedUntil: now + LOCK_MINUTES * 60 * 1000 });
      return "locked";
    }
    tx.update(ref, { failed });
    return "wrong";
  });
}

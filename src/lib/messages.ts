import "server-only";
import { adminDb } from "./firebase-admin";
import type { GuardianMessage } from "./types";

export interface OutgoingMessage {
  phone: string; // E.164 guardian number — the inbox it lands in
  message: string;
  studentId?: string;
}

/**
 * Delivers messages to guardians' in-app inbox (the Messages card in the guardian portal).
 * This replaces paid SMS: nothing leaves the app and nothing costs money.
 */
export async function postMessages(messages: OutgoingMessage[], sentBy: string, kind: GuardianMessage["kind"]): Promise<{ sent: number }> {
  const db = adminDb();
  const now = Date.now();
  for (let i = 0; i < messages.length; i += 400) {
    const wb = db.batch();
    messages.slice(i, i + 400).forEach((m, j) => {
      const doc: Omit<GuardianMessage, "id"> = {
        phone: m.phone,
        message: m.message,
        kind,
        sentBy,
        createdAt: now + i + j, // keeps the order they were sent in
        ...(m.studentId ? { studentId: m.studentId } : {}),
      };
      wb.set(db.collection("messages").doc(), doc);
    });
    await wb.commit();
  }
  return { sent: messages.length };
}

/** Latest messages for one guardian number, newest first. */
export async function messagesFor(phone: string, max = 30): Promise<GuardianMessage[]> {
  const snap = await adminDb().collection("messages").where("phone", "==", phone).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<GuardianMessage, "id">), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
}

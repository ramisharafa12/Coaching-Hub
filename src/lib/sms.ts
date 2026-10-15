import "server-only";
import { adminDb } from "./firebase-admin";

export interface SmsMessage {
  phone: string; // E.164
  message: string;
}

export interface SmsResult {
  sent: number;
  failed: number;
  mode: "log" | "http";
}

/**
 * Sends SMS through whichever gateway is configured.
 *
 * SMS_PROVIDER=log  (default) records messages in the smsLog collection without sending —
 *                   safe for development and demos.
 * SMS_PROVIDER=http calls SMS_API_URL for each message, replacing {number} and {message}.
 *                   Works with most Bangladeshi gateways (BulkSMSBD, SSL Wireless, Alpha SMS, …);
 *                   copy the exact URL format from your gateway's docs.
 */
export async function sendSms(messages: SmsMessage[], sentBy: string, kind: string): Promise<SmsResult> {
  const mode = process.env.SMS_PROVIDER === "http" ? "http" : "log";
  const db = adminDb();
  let sent = 0;
  let failed = 0;

  for (const m of messages) {
    let status = "logged";
    let detail = "";
    if (mode === "http") {
      try {
        const template = process.env.SMS_API_URL || "";
        if (!template) throw new Error("SMS_API_URL is not set");
        const number = m.phone.replace(/^\+/, ""); // most BD gateways want 8801XXXXXXXXX
        const url = template
          .replace("{number}", encodeURIComponent(number))
          .replace("{message}", encodeURIComponent(m.message));
        const method = (process.env.SMS_HTTP_METHOD || "GET").toUpperCase();
        const res = await fetch(url, { method });
        detail = (await res.text()).slice(0, 300);
        status = res.ok ? "sent" : "failed";
      } catch (err) {
        status = "failed";
        detail = err instanceof Error ? err.message : String(err);
      }
    }
    if (status === "failed") failed++;
    else sent++;

    await db.collection("smsLog").add({
      phone: m.phone,
      message: m.message,
      kind,
      status,
      detail,
      sentBy,
      createdAt: Date.now(),
    });
  }

  return { sent, failed, mode };
}

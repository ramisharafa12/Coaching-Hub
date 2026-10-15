import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, handle, resolveIdentity, verifyRequest } from "@/lib/api-auth";
import { demoPaymentsEnabled } from "@/lib/config";
import { adminDb } from "@/lib/firebase-admin";
import type { Batch, Payment } from "@/lib/types";
import { dhakaMonth } from "@/lib/utils";

export const dynamic = "force-dynamic";

const METHODS: Payment["method"][] = ["bKash", "Nagad"];

/**
 * Demo online fee payment from the guardian portal. Nothing is charged and no money moves:
 * it only records a payment marked `demo: true`, so the fee status updates by itself, the way
 * a real payment gateway would.
 */
export const POST = handle(async (req: Request) => {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "guardian" || !id.children?.length) throw new HttpError(403, "Guardians only");
  if (!demoPaymentsEnabled()) throw new HttpError(403, "Demo payments are turned off for this center");

  const body = (await req.json().catch(() => ({}))) as { studentId?: string; amount?: number; method?: string };
  const child = id.children.find((c) => c.id === body.studentId);
  if (!child) throw new HttpError(404, "Student not found");
  const method = METHODS.find((m) => m === body.method);
  if (!method) throw new HttpError(400, "Pick bKash or Nagad");
  const amount = Math.round(Number(body.amount));
  if (!(amount > 0)) throw new HttpError(400, "Amount must be more than 0");

  const db = adminDb();
  const month = dhakaMonth();
  const [batchSnap, paidSnap] = await Promise.all([
    db.collection("batches").doc(child.batchId).get(),
    db.collection("payments").where("studentId", "==", child.id).get(),
  ]);
  const fee = batchSnap.exists ? (batchSnap.data() as Batch).fee : 0;
  const paid = paidSnap.docs.map((d) => d.data() as Payment).filter((p) => p.month === month).reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, fee - paid);
  if (!due) throw new HttpError(400, "Nothing is due this month");
  if (amount > due) throw new HttpError(400, `That's more than the amount due (৳${due})`);

  const payment: Omit<Payment, "id"> = {
    studentId: child.id,
    batchId: child.batchId,
    month,
    amount,
    method,
    reference: `DEMO-${randomBytes(3).toString("hex").toUpperCase()}`,
    demo: true,
    recordedBy: "guardian",
    createdAt: Date.now(),
  };
  await db.collection("payments").add(payment);
  return NextResponse.json({ reference: payment.reference, amount, dueLeft: due - amount });
});

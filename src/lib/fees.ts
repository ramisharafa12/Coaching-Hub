import type { Batch, Payment, Student } from "./types";

export type FeeStatus = "Paid" | "Partial" | "Due";

export interface FeeRow {
  student: Student;
  batch?: Batch;
  fee: number;
  paid: number;
  due: number;
  status: FeeStatus;
  lastPayment?: Payment;
}

/** Fee position of every student for one month (YYYY-MM). */
export function feeRows(students: Student[], batches: Map<string, Batch>, payments: Payment[], month: string): FeeRow[] {
  const byStudent = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = byStudent.get(p.studentId) || [];
    list.push(p);
    byStudent.set(p.studentId, list);
  }
  return students.map((student) => {
    const batch = batches.get(student.batchId);
    const fee = batch?.fee || 0;
    const mine = (byStudent.get(student.id) || []).sort((a, b) => b.createdAt - a.createdAt);
    const paid = mine.filter((p) => p.month === month).reduce((s, p) => s + p.amount, 0);
    const due = Math.max(0, fee - paid);
    const status: FeeStatus = due === 0 ? "Paid" : paid > 0 ? "Partial" : "Due";
    return { student, batch, fee, paid, due, status, lastPayment: mine[0] };
  });
}

export function feeReminderText(appName: string, row: FeeRow, monthText: string): string {
  return `${appName}: ${row.student.name}-এর ${monthText} মাসের বেতন ৳${row.due} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।`;
}

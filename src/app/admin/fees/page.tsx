"use client";

import { addDoc, collection, deleteDoc, doc, where } from "firebase/firestore";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Empty, ErrorNote, Modal, PageHeader, Spinner, StatCard, Tabs } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { feeReminderText, feeRows, type FeeRow } from "@/lib/fees";
import { useById, useCollection } from "@/lib/hooks";
import type { Batch, Payment, Student } from "@/lib/types";
import { dhakaMonth, formatShortDate, monthLabel, shortBatch, taka } from "@/lib/utils";

const METHODS: Payment["method"][] = ["bKash", "Nagad", "Cash", "Bank"];

export default function FeesPage() {
  const { api } = useAuth();
  const [month, setMonth] = useState(dhakaMonth());
  const students = useCollection<Student>("students");
  const batches = useCollection<Batch>("batches");
  const payments = useCollection<Payment>("payments", [where("month", "==", month)], month);
  const batchMap = useById(batches.data);
  const studentMap = useById(students.data);
  const [tab, setTab] = useState<"due" | "paid">("due");
  const [batchFilter, setBatchFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ studentId: "", amount: 0, method: "bKash" as Payment["method"], reference: "" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => feeRows(students.data, batchMap, payments.data, month), [students.data, batchMap, payments.data, month]);
  const scoped = rows.filter((r) => !batchFilter || r.student.batchId === batchFilter);
  const due = scoped.filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
  const collected = payments.data
    .filter((p) => !batchFilter || p.batchId === batchFilter)
    .reduce((s, p) => s + p.amount, 0);
  const totalDue = due.reduce((s, r) => s + r.due, 0);
  const paidList = [...payments.data]
    .filter((p) => !batchFilter || p.batchId === batchFilter)
    .sort((a, b) => b.createdAt - a.createdAt);

  function openRecord(row?: FeeRow) {
    setForm({ studentId: row?.student.id || "", amount: row?.due || 0, method: "bKash", reference: "" });
    setError(null);
    setOpen(true);
  }

  async function record(e: React.FormEvent) {
    e.preventDefault();
    const s = studentMap.get(form.studentId);
    if (!s) return setError("Pick a student.");
    if (!(form.amount > 0)) return setError("Amount must be more than 0.");
    if ((form.method === "bKash" || form.method === "Nagad") && !form.reference.trim())
      return setError(`Enter the ${form.method} transaction ID so it can be checked later.`);
    const p: Omit<Payment, "id"> = {
      studentId: s.id,
      batchId: s.batchId,
      month,
      amount: form.amount,
      method: form.method,
      reference: form.reference.trim().toUpperCase(),
      recordedBy: "staff",
      createdAt: Date.now(),
    };
    await addDoc(collection(db, "payments"), p);
    setOpen(false);
  }

  async function remind(list: FeeRow[]) {
    if (!list.length) return;
    try {
      const r = await api<{ sent: number }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          kind: "fee",
          messages: list.map((row) => ({
            phone: row.student.guardianPhone,
            studentId: row.student.id,
            message: feeReminderText(APP_NAME, row, monthLabel(month)),
          })),
        }),
      });
      setSent((s) => ({ ...s, ...Object.fromEntries(list.map((l) => [l.student.id, true])) }));
      setMsg(`Sent ${r.sent} reminder${r.sent === 1 ? "" : "s"} to guardians' inboxes.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send");
    }
  }

  async function undo(p: Payment) {
    if (confirm(`Delete this ${taka(p.amount)} payment?`)) await deleteDoc(doc(db, "payments", p.id));
  }

  if (students.loading || batches.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle={`${monthLabel(month)} · ${batchFilter ? batchMap.get(batchFilter)?.name : "all batches"}`}
        actions={<Button onClick={() => openRecord()}>+ Record payment</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="field w-auto bg-white" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select className="field w-auto bg-white" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="">All batches</option>
          {batches.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Collected this month" value={taka(collected)} tone="brand" />
        <StatCard label="Fees due" value={taka(totalDue)} tone="danger" />
        <StatCard label="Students with dues" value={due.length} />
      </div>

      {msg && <Card className="mb-4 text-sm">{msg}</Card>}

      <Card>
        <div className="flex items-start justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "due", label: `Due list (${due.length})` },
              { value: "paid", label: `Payments (${paidList.length})` },
            ]}
          />
          {tab === "due" && due.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => remind(due.filter((r) => !sent[r.student.id]))}>
              Remind all guardians
            </Button>
          )}
        </div>

        {tab === "due" ? (
          due.length === 0 ? (
            <Empty>Everyone has paid for {monthLabel(month)}. 🎉</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Amount due</th>
                    <th>Status</th>
                    <th>Paid this month</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {due.map((r) => (
                    <tr key={r.student.id}>
                      <td className="font-semibold">{r.student.name}</td>
                      <td className="whitespace-nowrap">{shortBatch(r.batch?.name)}</td>
                      <td>{taka(r.due)}</td>
                      <td>
                        <Badge tone="yellow">{r.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {r.paid > 0 && r.lastPayment
                          ? `${taka(r.paid)} · ${r.lastPayment.method}${r.lastPayment.reference ? " " + r.lastPayment.reference : ""}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="inline-flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openRecord(r)}>
                            Record payment
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remind([r])} disabled={sent[r.student.id]}>
                            {sent[r.student.id] ? "Sent" : "Remind"}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : paidList.length === 0 ? (
          <Empty>No payments recorded for {monthLabel(month)}.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paidList.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{formatShortDate(p.createdAt)}</td>
                    <td className="font-semibold">{studentMap.get(p.studentId)?.name || "Removed student"}</td>
                    <td>{taka(p.amount)}</td>
                    <td className="whitespace-nowrap">
                      {p.method}
                      {p.demo && (
                        <span className="ml-1.5" title="Paid with the guardian portal's demo checkout — no real money moved">
                          <Badge tone="yellow">Demo</Badge>
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs">{p.reference || "—"}</td>
                    <td className="text-right">
                      <button className="text-xs text-danger" onClick={() => undo(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={`Record payment · ${monthLabel(month)}`}>
        <form onSubmit={record} className="space-y-4">
          <div>
            <label className="label">Student</label>
            <select
              className="field"
              value={form.studentId}
              onChange={(e) => {
                const row = rows.find((r) => r.student.id === e.target.value);
                setForm({ ...form, studentId: e.target.value, amount: row?.due || form.amount });
              }}
            >
              <option value="">Select…</option>
              {[...students.data]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.roll} · {shortBatch(batchMap.get(s.batchId)?.name)}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (৳)</label>
              <input className="field" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as Payment["method"] })}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          {form.method !== "Cash" && (
            <div>
              <label className="label">{form.method} transaction ID</label>
              <input className="field font-mono uppercase" placeholder="8N7A5K2QXD" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          )}
          <ErrorNote>{error}</ErrorNote>
          <Button className="w-full">Save payment</Button>
        </form>
      </Modal>
    </>
  );
}

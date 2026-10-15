"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NoticeList, SummaryCards, WeakChapters } from "@/components/SummaryCards";
import { Button, Card, ErrorNote, Modal, Spinner } from "@/components/ui";
import type { StudentSummary } from "@/lib/exam-server";
import type { GuardianMessage } from "@/lib/types";
import { cx, examDateLabel, formatDateTime, monthLabel, taka } from "@/lib/utils";

interface GuardianData {
  children: StudentSummary[];
  messages: GuardianMessage[];
  demoPayments: boolean;
}

export default function GuardianPortal() {
  const { api } = useAuth();
  const [data, setData] = useState<GuardianData | null>(null);
  const [active, setActive] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<GuardianData>("/api/guardian")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;
  const { children, messages } = data;
  const s = children[active];
  const results = s.exams.filter((e) => e.state === "ended");
  const names = new Map(children.map((c) => [c.student.id, c.student.name.split(" ")[0]]));

  return (
    <div className="space-y-5">
      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map((c, i) => (
            <button
              key={c.student.id}
              onClick={() => setActive(i)}
              className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", i === active ? "bg-brand text-white" : "bg-white")}
            >
              {c.student.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}
      <div>
        <div className="text-xs text-muted">Student</div>
        <h1 className="text-3xl font-bold tracking-tight">{s.student.name}</h1>
        <div className="text-xs text-muted">{s.student.batchName}</div>
      </div>

      <SummaryCards s={s} onPay={data.demoPayments ? () => setPaying(true) : undefined} />
      <p className="text-xs text-muted">Absence alerts, results and fee reminders from the center appear under Messages.</p>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="mb-2 text-sm font-semibold">Exam results</div>
            {results.length === 0 ? (
              <p className="text-sm text-muted">No results yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-sm font-semibold">{e.title}</div>
                      <div className="text-xs text-muted">{examDateLabel(e.startAt)}</div>
                    </div>
                    <div className="text-sm font-bold">
                      {e.submitted ? (
                        <>
                          {e.score} <span className="font-normal text-muted">/ {e.totalMarks}</span>
                        </>
                      ) : (
                        <span className="text-danger">Absent</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <div className="mb-2 text-sm font-semibold">Messages</div>
            {messages.length === 0 ? (
              <p className="text-sm text-muted">No messages yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {messages.map((m) => (
                  <li key={m.id} className="py-2.5">
                    <div className="text-sm">{m.message}</div>
                    <div className="text-xs text-muted">
                      {formatDateTime(m.createdAt)}
                      {children.length > 1 && m.studentId && names.get(m.studentId) ? ` · ${names.get(m.studentId)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <WeakChapters s={s} />
          <NoticeList s={s} />
        </div>
      </div>

      {paying && (
        <DemoCheckout
          child={s}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Practice checkout for the monthly fee. It is plainly a demo: no wallet number or PIN is asked
 * for, nothing is charged, and the payment is recorded with a "Demo" mark the center can see.
 */
function DemoCheckout({ child, onClose, onPaid }: { child: StudentSummary; onClose: () => void; onPaid: () => void }) {
  const { api } = useAuth();
  const due = Math.max(0, child.fee.amount - child.fee.paid);
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<"bKash" | "Nagad">("bKash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; amount: number } | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ reference: string; amount: number }>("/api/guardian/pay-demo", {
        method: "POST",
        body: JSON.stringify({ studentId: child.student.id, amount, method }),
      });
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={done ? onPaid : onClose} title="Pay monthly fee">
      <div className="mb-4 rounded-lg border-2 border-dashed border-warn bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
        Demo — no real money moves. This only shows how online payment would work.
      </div>
      {done ? (
        <div className="space-y-3 text-sm">
          <p>
            Demo payment of <b>{taka(done.amount)}</b> recorded for {child.student.name}.
          </p>
          <p className="text-muted">
            Reference: <span className="font-mono">{done.reference}</span>
          </p>
          <Button className="w-full" onClick={onPaid}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={pay} className="space-y-4">
          <div className="text-sm">
            {child.student.name} · {monthLabel(child.fee.month)} · due <b>{taka(due)}</b>
          </div>
          <div>
            <label className="label">Amount (৳)</label>
            <input className="field" type="number" min={1} max={due} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Method (label only)</label>
            <div className="flex gap-2">
              {(["bKash", "Nagad"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cx("flex-1 rounded-lg border px-3 py-2 text-sm font-semibold", method === m ? "border-brand bg-brand-soft" : "border-line")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <Button className="w-full" disabled={busy || !(amount > 0) || amount > due}>
            {busy ? "Recording…" : `Confirm demo payment of ${taka(amount || 0)}`}
          </Button>
        </form>
      )}
    </Modal>
  );
}

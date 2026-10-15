"use client";

import { Badge, Card } from "@/components/ui";
import type { StudentSummary } from "@/lib/exam-server";
import { cx, monthLabel, ordinal, taka } from "@/lib/utils";

function weekday(date: string) {
  return new Date(`${date}T12:00:00+06:00`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Dhaka" });
}

/** The three cards from the guardian mockup: attendance, latest exam, monthly fee. */
export function SummaryCards({ s, onPay }: { s: StudentSummary; onPay?: () => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card>
        <div className="mb-3 text-sm font-semibold">This week&apos;s attendance</div>
        {s.attendance.length === 0 ? (
          <p className="text-sm text-muted">No classes recorded this week.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {s.attendance.map((a) => (
              <div key={a.date} className="flex flex-col items-center gap-1">
                <span
                  className={cx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                    a.status === "P" ? "bg-brand-soft text-brand-dark" : "border border-warn bg-warn-soft text-warn"
                  )}
                >
                  {a.status}
                </span>
                <span className="text-[0.65rem] text-muted">{weekday(a.date)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">P = Present · A = Absent</p>
      </Card>

      <Card>
        <div className="text-sm font-semibold">Latest exam</div>
        {s.latestResult ? (
          <>
            <div className="text-xs text-muted">{s.latestResult.title}</div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <span className="text-4xl font-bold">{s.latestResult.score}</span>
                <span className="text-muted"> / {s.latestResult.totalMarks}</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand">{ordinal(s.latestResult.rank)} in batch</div>
                <div className="text-xs text-muted">out of {s.latestResult.outOf} students</div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No finished exams yet.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold">Monthly fee</div>
            <div className="text-xs text-muted">{monthLabel(s.fee.month)}</div>
          </div>
          <Badge tone={s.fee.status === "Paid" ? "green" : "yellow"}>{s.fee.status}</Badge>
        </div>
        <div className="mt-4 text-3xl font-bold">{taka(s.fee.amount)}</div>
        {s.fee.status === "Partial" && <div className="text-xs text-muted">Paid {taka(s.fee.paid)} · {taka(s.fee.amount - s.fee.paid)} left</div>}
        {onPay && s.fee.status !== "Paid" && (
          <button onClick={onPay} className="mt-3 w-full rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft/50">
            Pay online (demo)
          </button>
        )}
      </Card>
    </div>
  );
}

export function WeakChapters({ s }: { s: StudentSummary }) {
  if (!s.weakChapters.length) return null;
  return (
    <Card>
      <div className="mb-3 text-sm font-semibold">Chapters to work on</div>
      <ul className="space-y-2.5">
        {s.weakChapters.map((c) => (
          <li key={c.chapter}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{c.chapter}</span>
              <span className={cx("font-semibold", c.percent < 50 ? "text-danger" : c.percent < 75 ? "text-warn" : "text-brand")}>{c.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-mint">
              <div
                className={cx("h-full rounded-full", c.percent < 50 ? "bg-danger" : c.percent < 75 ? "bg-warn" : "bg-brand")}
                style={{ width: `${c.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function NoticeList({ s }: { s: StudentSummary }) {
  if (!s.notices.length) return null;
  return (
    <Card>
      <div className="mb-2 text-sm font-semibold">Notices</div>
      <ul className="divide-y divide-line">
        {s.notices.map((n) => (
          <li key={n.id} className="py-2.5">
            <div className="text-sm font-semibold">{n.title}</div>
            {n.message && <div className="text-sm text-muted">{n.message}</div>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

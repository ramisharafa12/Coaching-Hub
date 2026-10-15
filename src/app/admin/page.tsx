"use client";

import { where } from "firebase/firestore";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Spinner, StatCard } from "@/components/ui";
import { APP_NAME, SESSION_LABEL } from "@/lib/config";
import { loadDemoData } from "@/lib/demo";
import { feeReminderText, feeRows } from "@/lib/fees";
import { useById, useCollection } from "@/lib/hooks";
import type { AttendanceDoc, Batch, Exam, Payment, Student } from "@/lib/types";
import { dhakaDate, dhakaMonth, examState, monthLabel, prettyPhone, round2, shortBatch, taka } from "@/lib/utils";

export default function Dashboard() {
  const { api } = useAuth();
  const today = dhakaDate();
  const month = dhakaMonth();
  const batches = useCollection<Batch>("batches");
  const students = useCollection<Student>("students");
  const exams = useCollection<Exam>("exams");
  const payments = useCollection<Payment>("payments", [where("month", "==", month)], month);
  const attendance = useCollection<AttendanceDoc>("attendance", [where("date", "==", today)], today);
  const batchMap = useById(batches.data);
  const [seeding, setSeeding] = useState(false);
  const [smsSent, setSmsSent] = useState<Record<string, boolean>>({});

  const rows = useMemo(
    () => feeRows(students.data, batchMap, payments.data, month).filter((r) => r.due > 0),
    [students.data, batchMap, payments.data, month]
  );
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const presentToday = attendance.data.reduce((n, a) => n + Object.values(a.records).filter((v) => v === "P").length, 0);
  const now = Date.now();
  const nextExam = exams.data.filter((e) => e.startAt > now).sort((a, b) => a.startAt - b.startAt)[0];
  const recent = [...exams.data].sort((a, b) => b.startAt - a.startAt).slice(0, 5);

  if (batches.loading || students.loading || exams.loading) return <Spinner />;

  async function seed() {
    setSeeding(true);
    try {
      await loadDemoData();
    } finally {
      setSeeding(false);
    }
  }

  async function remind(studentId: string) {
    const row = rows.find((r) => r.student.id === studentId);
    if (!row) return;
    await api("/api/sms", {
      method: "POST",
      body: JSON.stringify({
        kind: "fee",
        messages: [{ phone: row.student.guardianPhone, message: feeReminderText(APP_NAME, row, monthLabel(month)) }],
      }),
    });
    setSmsSent((s) => ({ ...s, [studentId]: true }));
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${SESSION_LABEL} · all batches`}
        actions={
          <Link href="/admin/exams/new">
            <Button>+ New exam</Button>
          </Link>
        }
      />

      {batches.data.length === 0 && (
        <Card className="mb-5 border border-dashed border-brand/40">
          <CardTitle>Your center is empty</CardTitle>
          <p className="mb-4 text-sm text-muted">
            Start by creating batches and adding students, or load sample data (6 batches, 12 students, 12 physics questions,
            a live exam) to try everything first. You can delete it later.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={seed} disabled={seeding}>
              {seeding ? "Loading…" : "Load demo data"}
            </Button>
            <Link href="/admin/batches">
              <Button variant="outline">Create a batch</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Students" value={students.data.length} />
        <StatCard label="Present today" value={presentToday} />
        <StatCard label="Fees due" value={taka(totalDue)} />
        <StatCard
          label="Next exam"
          value={
            nextExam
              ? new Date(nextExam.startAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).replace(",", "")
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardTitle action={<Link href="/admin/exams" className="text-xs font-semibold text-brand">All exams</Link>}>
            Recent exam results
          </CardTitle>
          {recent.length === 0 ? (
            <Empty>No exams yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Batch</th>
                    <th>Average</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => {
                    const st = examState(e, now);
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link href={`/admin/exams/${e.id}`} className="hover:text-brand">
                            {e.title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{shortBatch(batchMap.get(e.batchId)?.name)}</td>
                        <td className="whitespace-nowrap">
                          {e.submittedCount ? `${round2(e.scoreSum / e.submittedCount)} / ${e.totalMarks}` : "—"}
                        </td>
                        <td>
                          {st === "live" ? <Badge tone="green">Live now</Badge> : st === "scheduled" ? <Badge>Scheduled</Badge> : "Published"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle action={<Link href="/admin/fees" className="text-xs font-semibold text-brand">Fees</Link>}>
            Fees due this month
          </CardTitle>
          {rows.length === 0 ? (
            <Empty>Nobody owes anything for {monthLabel(month)}.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {rows.slice(0, 6).map((r) => (
                <li key={r.student.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.student.name}</div>
                    <div className="text-xs text-muted">
                      {shortBatch(r.batch?.name)} · {taka(r.due)} · {prettyPhone(r.student.guardianPhone)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => remind(r.student.id)} disabled={smsSent[r.student.id]}>
                    {smsSent[r.student.id] ? "Sent" : "Send SMS"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

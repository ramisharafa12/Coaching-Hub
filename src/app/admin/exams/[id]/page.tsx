"use client";

import { deleteDoc, doc, writeBatch, collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MathText } from "@/components/MathText";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Spinner, StatCard, Tabs } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { useCollection, useDoc } from "@/lib/hooks";
import type { Batch, Exam, Student, Submission } from "@/lib/types";
import { examDateLabel, examEndsAt, examState, ordinal, round2 } from "@/lib/utils";
import { where } from "firebase/firestore";

const LETTERS = ["A", "B", "C", "D"];
type Tab = "merit" | "insight" | "absent";

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api, profile } = useAuth();
  const exam = useDoc<Exam>(`exams/${id}`);
  const subs = useCollection<Submission & { id: string }>(`exams/${id}/submissions`);
  const batch = useDoc<Batch>(exam.data ? `batches/${exam.data.batchId}` : null);
  const students = useCollection<Student>(
    exam.data ? "students" : null,
    exam.data ? [where("batchId", "==", exam.data.batchId)] : [],
    exam.data?.batchId || ""
  );
  const [tab, setTab] = useState<Tab>("merit");
  const [now, setNow] = useState(Date.now());
  const [smsState, setSmsState] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const merit = useMemo(() => {
    const sorted = [...subs.data].sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
    // Equal scores share a rank
    return sorted.map((s) => ({ ...s, rank: sorted.filter((x) => x.score > s.score).length + 1 }));
  }, [subs.data]);

  const insight = useMemo(() => {
    if (!exam.data) return [];
    return exam.data.questions
      .map((q, idx) => {
        const picks = [0, 0, 0, 0];
        let skipped = 0;
        for (const s of subs.data) {
          const a = s.answers[q.id];
          if (typeof a === "number") picks[a]++;
          else skipped++;
        }
        const total = subs.data.length;
        const wrong = picks.reduce((n, c, i) => (i === q.answer ? n : n + c), 0);
        const commonWrong = picks.map((c, i) => ({ c, i })).filter((x) => x.i !== q.answer).sort((a, b) => b.c - a.c)[0];
        return { q, idx, picks, skipped, total, wrong, wrongPct: total ? Math.round((wrong / total) * 100) : 0, commonWrong };
      })
      .sort((a, b) => b.wrongPct - a.wrongPct);
  }, [exam.data, subs.data]);

  if (exam.loading) return <Spinner />;
  if (!exam.data) return <Empty>Exam not found.</Empty>;
  const e = exam.data;
  const st = examState(e, now);
  const submittedIds = new Set(subs.data.map((s) => s.studentId));
  const absent = students.data.filter((s) => !submittedIds.has(s.id));
  const avg = subs.data.length ? round2(subs.data.reduce((n, s) => n + s.score, 0) / subs.data.length) : 0;
  const top = merit[0]?.score ?? 0;
  const left = Math.max(0, examEndsAt(e) - now);

  async function remove() {
    if (subs.data.length && profile?.role !== "admin") return alert("Only an admin can delete an exam that has submissions.");
    if (!confirm(`Delete "${e.title}" and all its results?`)) return;
    const snap = await getDocs(collection(db, "exams", e.id, "submissions"));
    const wb = writeBatch(db);
    snap.docs.forEach((d) => wb.delete(d.ref));
    await wb.commit();
    await deleteDoc(doc(db, "exams", e.id));
    router.push("/admin/exams");
  }

  async function smsResults() {
    const byId = new Map(students.data.map((s) => [s.id, s]));
    const messages = merit
      .map((m) => {
        const s = byId.get(m.studentId);
        if (!s) return null;
        return {
          phone: s.guardianPhone,
          message: `${APP_NAME}: ${s.name} "${e.title}" পরীক্ষায় ${m.score}/${e.totalMarks} পেয়েছে। ব্যাচে অবস্থান ${m.rank}/${merit.length}।`,
        };
      })
      .filter(Boolean);
    const absentMsgs = absent.map((s) => ({
      phone: s.guardianPhone,
      message: `${APP_NAME}: ${s.name} "${e.title}" পরীক্ষায় অংশ নেয়নি।`,
    }));
    if (!confirm(`Send ${messages.length + absentMsgs.length} result SMS to guardians?`)) return;
    setSmsState("Sending…");
    try {
      const r = await api<{ sent: number; failed: number; mode: string }>("/api/sms", {
        method: "POST",
        body: JSON.stringify({ kind: "result", messages: [...messages, ...absentMsgs] }),
      });
      setSmsState(r.mode === "log" ? `Logged ${r.sent} messages (SMS_PROVIDER=log, nothing actually sent).` : `Sent ${r.sent}, failed ${r.failed}.`);
    } catch (err) {
      setSmsState(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader
        title={e.title}
        subtitle={`${batch.data?.name || ""} · ${examDateLabel(e.startAt)} · ${e.durationMin} min · ${e.questions.length} questions · −${e.negativeMark} per wrong`}
        actions={
          <>
            <Link href={`/admin/exams/${e.id}/print`} target="_blank">
              <Button variant="outline">Print paper (A–D sets)</Button>
            </Link>
            {st === "ended" && (
              <Button variant="outline" onClick={smsResults} disabled={!merit.length && !absent.length}>
                SMS results to guardians
              </Button>
            )}
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      />
      {smsState && <Card className="mb-4 text-sm">{smsState}</Card>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Status"
          value={
            st === "live" ? (
              <span className="text-brand">
                Live · {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}
              </span>
            ) : st === "scheduled" ? (
              "Scheduled"
            ) : (
              "Published"
            )
          }
        />
        <StatCard label="Submitted" value={`${subs.data.length} / ${students.data.length}`} />
        <StatCard label="Average" value={subs.data.length ? `${avg} / ${e.totalMarks}` : "—"} />
        <StatCard label="Highest" value={subs.data.length ? `${top} / ${e.totalMarks}` : "—"} />
      </div>

      <Card>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "merit", label: `Merit list (${merit.length})` },
            { value: "insight", label: "Question insight" },
            { value: "absent", label: `Didn't sit (${absent.length})` },
          ]}
        />

        {tab === "merit" &&
          (merit.length === 0 ? (
            <Empty>{st === "scheduled" ? "The exam hasn't started yet." : "No submissions yet."}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Roll</th>
                    <th>Correct</th>
                    <th>Wrong</th>
                    <th>Skipped</th>
                    <th>Score</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {merit.map((m) => (
                    <tr key={m.studentId}>
                      <td className="font-semibold">{ordinal(m.rank)}</td>
                      <td className="font-semibold">{m.studentName}</td>
                      <td>{m.roll}</td>
                      <td className="text-brand">{m.correct}</td>
                      <td className="text-danger">{m.wrong}</td>
                      <td className="text-muted">{m.skipped}</td>
                      <td className="font-bold">
                        {m.score} / {e.totalMarks}
                      </td>
                      <td>{m.tabSwitches > 0 && <Badge tone={m.tabSwitches > 2 ? "red" : "yellow"}>Left tab {m.tabSwitches}×</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "insight" &&
          (subs.data.length === 0 ? (
            <Empty>Insight appears once students submit.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {insight.map(({ q, idx, picks, total, wrongPct, commonWrong, skipped }) => (
                <li key={q.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 text-sm">
                      <span className="mr-1 text-muted">Q{idx + 1}.</span>
                      <MathText text={q.text} />
                      <div className="mt-0.5 text-xs text-muted">{q.chapter}</div>
                    </div>
                    <Badge tone={wrongPct >= 50 ? "red" : wrongPct >= 25 ? "yellow" : "green"}>{wrongPct}% wrong</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {q.options.map((opt, i) => {
                      const pct = total ? Math.round((picks[i] / total) * 100) : 0;
                      const right = i === q.answer;
                      return (
                        <div key={i} className="relative overflow-hidden rounded-lg border border-line px-2 py-1.5 text-xs">
                          <div className={`absolute inset-y-0 left-0 ${right ? "bg-brand-soft" : "bg-danger-soft/70"}`} style={{ width: `${pct}%` }} />
                          <div className="relative flex justify-between gap-2">
                            <span className={right ? "font-bold text-brand-dark" : ""}>
                              {LETTERS[i]}. <MathText text={opt} />
                            </span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {commonWrong && commonWrong.c > 0 && (
                    <p className="mt-1.5 text-xs text-muted">
                      Most common mistake: option {LETTERS[commonWrong.i]} ({commonWrong.c} students){skipped ? ` · ${skipped} skipped` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "absent" &&
          (absent.length === 0 ? (
            <Empty>Everyone in the batch has submitted.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {absent.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-muted">{s.roll}</span>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </>
  );
}

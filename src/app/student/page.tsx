"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NoticeList, SummaryCards, WeakChapters } from "@/components/SummaryCards";
import { Badge, Button, Card, Empty, ErrorNote, Spinner } from "@/components/ui";
import type { StudentSummary } from "@/lib/exam-server";
import { examDateLabel } from "@/lib/utils";

export default function StudentHome() {
  const { api } = useAuth();
  const [data, setData] = useState<StudentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<StudentSummary>("/api/student/home").then(setData).catch((e) => setError(e.message));
  }, [api]);

  useEffect(() => {
    load();
    // refresh when the tab comes back into view (e.g. an exam just went live)
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;

  const live = data.exams.filter((e) => e.state === "live" && !e.submitted);
  const upcoming = data.exams.filter((e) => e.state === "scheduled").reverse();
  const done = data.exams.filter((e) => e.state === "ended" || (e.state === "live" && e.submitted));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-muted">Student</div>
        <h1 className="text-3xl font-bold tracking-tight">{data.student.name}</h1>
        <div className="text-xs text-muted">
          {data.student.roll} · {data.student.batchName}
        </div>
      </div>

      {live.map((e) => (
        <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-brand">
          <div>
            <Badge tone="green">Live now</Badge>
            <div className="mt-1 text-lg font-bold">{e.title}</div>
            <div className="text-xs text-muted">
              {e.questionCount} questions · {e.durationMin} min · −{e.negativeMark} per wrong answer
            </div>
          </div>
          <Link href={`/student/exam/${e.id}`}>
            <Button>Start exam</Button>
          </Link>
        </Card>
      ))}

      <SummaryCards s={data} />

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 text-sm font-semibold">Exams</div>
          {upcoming.length === 0 && done.length === 0 ? (
            <Empty>No exams yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{e.title}</div>
                    <div className="text-xs text-muted">
                      {examDateLabel(e.startAt)} · {e.durationMin} min
                    </div>
                  </div>
                  <Badge>Scheduled</Badge>
                </li>
              ))}
              {done.map((e) => (
                <li key={e.id}>
                  <Link href={`/student/exam/${e.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand">
                    <div>
                      <div className="text-sm font-semibold">{e.title}</div>
                      <div className="text-xs text-muted">{examDateLabel(e.startAt)}</div>
                    </div>
                    {e.submitted ? (
                      <span className="text-sm font-bold">
                        {e.score} <span className="font-normal text-muted">/ {e.totalMarks}</span>
                      </span>
                    ) : (
                      <Badge tone="red">Missed</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <WeakChapters s={data} />
          <NoticeList s={data} />
        </div>
      </div>
    </div>
  );
}

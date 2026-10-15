"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NoticeList, SummaryCards, WeakChapters } from "@/components/SummaryCards";
import { Card, ErrorNote, Spinner } from "@/components/ui";
import type { StudentSummary } from "@/lib/exam-server";
import { cx, examDateLabel } from "@/lib/utils";

export default function GuardianPortal() {
  const { api } = useAuth();
  const [children, setChildren] = useState<StudentSummary[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ children: StudentSummary[] }>("/api/guardian")
      .then((d) => setChildren(d.children))
      .catch((e) => setError(e.message));
  }, [api]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!children) return <Spinner />;
  const s = children[active];
  const results = s.exams.filter((e) => e.state === "ended");

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

      <SummaryCards s={s} />
      <p className="text-xs text-muted">You will get an SMS if your child is absent.</p>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
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
        <div className="space-y-4">
          <WeakChapters s={s} />
          <NoticeList s={s} />
        </div>
      </div>
    </div>
  );
}

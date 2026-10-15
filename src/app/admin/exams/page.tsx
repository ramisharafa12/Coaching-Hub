"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Empty, PageHeader, Spinner, Tabs } from "@/components/ui";
import { SESSION_LABEL } from "@/lib/config";
import { useById, useCollection } from "@/lib/hooks";
import type { Batch, Exam, ExamState } from "@/lib/types";
import { examDateLabel, examState, round2, shortBatch } from "@/lib/utils";

type Tab = "all" | ExamState;

export default function ExamsPage() {
  const exams = useCollection<Exam>("exams");
  const batches = useCollection<Batch>("batches");
  const batchMap = useById(batches.data);
  const [tab, setTab] = useState<Tab>("all");
  const now = Date.now();

  const list = exams.data
    .map((e) => ({ e, st: examState(e, now) }))
    .filter(({ st }) => tab === "all" || st === tab)
    .sort((a, b) => {
      const order = { live: 0, scheduled: 1, ended: 2 };
      if (order[a.st] !== order[b.st]) return order[a.st] - order[b.st];
      return a.st === "scheduled" ? a.e.startAt - b.e.startAt : b.e.startAt - a.e.startAt;
    });

  if (exams.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Exams"
        subtitle={`${SESSION_LABEL} · all batches`}
        actions={
          <Link href="/admin/exams/new">
            <Button>+ Create exam</Button>
          </Link>
        }
      />
      <Card>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All" },
            { value: "live", label: "Live" },
            { value: "scheduled", label: "Scheduled" },
            { value: "ended", label: "Published" },
          ]}
        />
        {list.length === 0 ? (
          <Empty>No exams here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Batch</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Marks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ e, st }) => (
                  <tr key={e.id}>
                    <td className="font-semibold">
                      <Link href={`/admin/exams/${e.id}`} className="hover:text-brand">
                        {e.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{shortBatch(batchMap.get(e.batchId)?.name)}</td>
                    <td className="whitespace-nowrap">{examDateLabel(e.startAt)}</td>
                    <td>{e.durationMin} min</td>
                    <td>{e.totalMarks}</td>
                    <td>
                      {st === "live" ? (
                        <Badge tone="green">Live now · {e.submittedCount} done</Badge>
                      ) : st === "scheduled" ? (
                        <Badge>Scheduled</Badge>
                      ) : (
                        <span className="text-xs text-muted">
                          Published · {e.submittedCount ? `${round2(e.scoreSum / e.submittedCount)} / ${e.totalMarks}` : "no submissions"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

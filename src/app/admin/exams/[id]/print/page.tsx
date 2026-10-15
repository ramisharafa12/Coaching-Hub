"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MathText } from "@/components/MathText";
import { Button, Chip, Empty, Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { useDoc } from "@/lib/hooks";
import type { Batch, Exam } from "@/lib/types";
import { cx, formatDateTime, seededShuffle } from "@/lib/utils";

const SETS = ["A", "B", "C", "D"] as const;
const LETTERS = ["ক", "খ", "গ", "ঘ"];
const LATIN = ["A", "B", "C", "D"];

/**
 * Print-ready question paper. Each set shuffles question order and option order,
 * so neighbours sitting side by side get different papers. Prints the answer
 * sheet (bubbles) and, separately, the answer key for every set.
 */
export default function PrintPaperPage() {
  const { id } = useParams<{ id: string }>();
  const exam = useDoc<Exam>(`exams/${id}`);
  const batch = useDoc<Batch>(exam.data ? `batches/${exam.data.batchId}` : null);
  const [set, setSet] = useState<(typeof SETS)[number]>("A");
  const [bangla, setBangla] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const paperFor = (e: Exam, s: string) =>
    seededShuffle(e.questions, `${e.id}:set:${s}`).map((q) => {
      const order = seededShuffle([0, 1, 2, 3].slice(0, q.options.length), `${e.id}:set:${s}:${q.id}`);
      return { ...q, order, correctPos: order.indexOf(q.answer) };
    });

  const paper = useMemo(() => (exam.data ? paperFor(exam.data, set) : []), [exam.data, set]);

  if (exam.loading) return <Spinner />;
  if (!exam.data) return <Empty>Exam not found.</Empty>;
  const e = exam.data;
  const L = bangla ? LETTERS : LATIN;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-mint p-3">
        <span className="text-sm font-semibold">Set:</span>
        {SETS.map((s) => (
          <Chip key={s} active={set === s} onClick={() => setSet(s)}>
            {s}
          </Chip>
        ))}
        <label className="ml-3 flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={bangla} onChange={(ev) => setBangla(ev.target.checked)} /> ক খ গ ঘ options
        </label>
        <label className="ml-3 flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={showKey} onChange={(ev) => setShowKey(ev.target.checked)} /> Include answer key page
        </label>
        <Button className="ml-auto" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      {/* Header */}
      <div className="border-b-2 border-black pb-2 text-center">
        <div className="text-xl font-bold">{APP_NAME}</div>
        <div className="text-base font-semibold">{e.title}</div>
        <div className="text-xs">
          {batch.data?.name} · {formatDateTime(e.startAt)}
        </div>
        <div className="mt-1 flex justify-between text-xs font-semibold">
          <span>Time: {e.durationMin} minutes</span>
          <span className="rounded border-2 border-black px-2">SET {set}</span>
          <span>
            Full marks: {e.totalMarks} · −{e.negativeMark} per wrong answer
          </span>
        </div>
      </div>
      <div className="mt-2 flex gap-6 text-xs">
        <span>Name: ______________________________</span>
        <span>Roll: ____________</span>
      </div>

      {/* Questions */}
      <ol className="mt-4 columns-2 gap-8 text-[13px] leading-snug">
        {paper.map((q, i) => (
          <li key={q.id} className="mb-3 break-inside-avoid">
            <div>
              <b>{i + 1}.</b> <MathText text={q.text} />
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 pl-4">
              {q.order.map((orig, pos) => (
                <div key={pos}>
                  ({L[pos]}) <MathText text={q.options[orig]} />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {/* OMR-style answer sheet */}
      <div className="mt-6 break-before-page border-t-2 border-black pt-3">
        <div className="mb-2 flex justify-between text-sm font-bold">
          <span>Answer sheet — {e.title}</span>
          <span>SET {set}</span>
        </div>
        <div className="mb-3 flex gap-6 text-xs">
          <span>Name: ______________________________</span>
          <span>Roll: ____________</span>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          {paper.map((q, i) => (
            <div key={q.id} className="flex items-center gap-1.5 text-xs">
              <span className="w-6 text-right font-semibold">{i + 1}</span>
              {L.slice(0, q.options.length).map((l) => (
                <span key={l} className="flex h-5 w-5 items-center justify-center rounded-full border border-black text-[10px]">
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px]">Fill one circle per question completely with a black pen.</p>
      </div>

      {/* Answer key for all sets (teacher copy) */}
      {showKey && (
        <div className={cx("mt-6 break-before-page border-t-2 border-black pt-3")}>
          <div className="mb-3 text-sm font-bold">Answer key — {e.title} (teacher copy)</div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {SETS.map((s) => (
              <div key={s}>
                <div className="mb-1 text-sm font-bold">Set {s}</div>
                <ol className="text-xs">
                  {paperFor(e, s).map((q, i) => (
                    <li key={q.id}>
                      {i + 1}. {L[q.correctPos]}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

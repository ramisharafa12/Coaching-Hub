"use client";

import { collection, doc, increment, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MathText } from "@/components/MathText";
import { Button, Card, CardTitle, Chip, Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { DIFFICULTIES } from "@/lib/config";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/hooks";
import type { Batch, Difficulty, Exam, Question } from "@/lib/types";
import { cx, dhakaLocalToMs, msToDhakaLocal, seededShuffle } from "@/lib/utils";

export default function NewExamPage() {
  const router = useRouter();
  const batches = useCollection<Batch>("batches");
  const questions = useCollection<Question>("questions");

  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState("");
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState(() => msToDhakaLocal(Math.ceil(Date.now() / 3600000) * 3600000));
  const [duration, setDuration] = useState(30);
  const [marksPer, setMarksPer] = useState(1);
  const [negative, setNegative] = useState(0.25);
  const [selected, setSelected] = useState<string[]>([]);
  const [chapterFilter, setChapterFilter] = useState<string[]>([]);
  const [diffFilter, setDiffFilter] = useState("");
  const [mix, setMix] = useState<Record<Difficulty, number>>({ Easy: 10, Medium: 15, Hard: 5 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Default to first batch and its subject
  useEffect(() => {
    if (!batchId && batches.data.length) {
      setBatchId(batches.data[0].id);
      setSubject(batches.data[0].subject);
    }
  }, [batches.data, batchId]);

  const pool = useMemo(() => questions.data.filter((q) => q.subject === subject), [questions.data, subject]);
  const chapters = useMemo(() => [...new Set(pool.map((q) => q.chapter))].sort(), [pool]);
  const visible = pool
    .filter((q) => !chapterFilter.length || chapterFilter.includes(q.chapter))
    .filter((q) => !diffFilter || q.difficulty === diffFilter);
  const byId = useMemo(() => new Map(questions.data.map((q) => [q.id, q])), [questions.data]);
  const picked = selected.map((id) => byId.get(id)).filter(Boolean) as Question[];

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // One-click paper generator: random questions from chosen chapters with a difficulty mix
  function autoPick() {
    const source = pool.filter((q) => !chapterFilter.length || chapterFilter.includes(q.chapter));
    const seed = String(Date.now());
    const chosen: string[] = [];
    const short: string[] = [];
    for (const d of DIFFICULTIES) {
      const want = mix[d] || 0;
      const avail = seededShuffle(source.filter((q) => q.difficulty === d), seed + d);
      chosen.push(...avail.slice(0, want).map((q) => q.id));
      if (avail.length < want) short.push(`${d}: wanted ${want}, only ${avail.length}`);
    }
    setSelected(chosen);
    setNote(short.length ? `Not enough questions — ${short.join("; ")}.` : `Picked ${chosen.length} questions.`);
  }

  async function create() {
    setError(null);
    if (!title.trim()) return setError("Give the exam a title.");
    if (!batchId) return setError("Pick a batch.");
    if (!picked.length) return setError("Select at least one question.");
    if (duration < 1) return setError("Duration must be at least 1 minute.");
    setSaving(true);
    try {
      const ref = doc(collection(db, "exams"));
      const exam: Omit<Exam, "id"> = {
        title: title.trim(),
        batchId,
        subject,
        startAt: dhakaLocalToMs(start),
        durationMin: duration,
        marksPerQuestion: marksPer,
        negativeMark: negative,
        questions: picked.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation || "",
          chapter: q.chapter,
          difficulty: q.difficulty,
        })),
        totalMarks: picked.length * marksPer,
        submittedCount: 0,
        scoreSum: 0,
        createdAt: Date.now(),
      };
      const wb = writeBatch(db);
      wb.set(ref, exam);
      picked.forEach((q) => wb.update(doc(db, "questions", q.id), { usedIn: increment(1) }));
      await wb.commit();
      router.push(`/admin/exams/${ref.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create exam");
      setSaving(false);
    }
  }

  if (batches.loading || questions.loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Create exam" subtitle="Online MCQ exam with timer, negative marking and shuffled questions" />

      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card>
            <CardTitle>Details</CardTitle>
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="field" placeholder="Model Test 05 · Physics" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Batch</label>
                <select
                  className="field"
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    const b = batches.data.find((x) => x.id === e.target.value);
                    if (b && b.subject !== subject) {
                      setSubject(b.subject);
                      setSelected([]);
                      setChapterFilter([]);
                    }
                  }}
                >
                  {batches.data.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Starts at (Dhaka time)</label>
                <input className="field" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Minutes</label>
                  <input className="field" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Marks / Q</label>
                  <input className="field" type="number" min={0.25} step={0.25} value={marksPer} onChange={(e) => setMarksPer(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Negative</label>
                  <input className="field" type="number" min={0} step={0.05} value={negative} onChange={(e) => setNegative(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Auto-generate paper</CardTitle>
            <p className="mb-3 text-xs text-muted">Pick chapters on the right (or none for all), set the mix, and generate.</p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <div key={d}>
                  <label className="label">{d}</label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={mix[d]}
                    onChange={(e) => setMix({ ...mix, [d]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={autoPick} disabled={!pool.length}>
              Generate question set
            </Button>
            {note && <p className="mt-2 text-xs text-muted">{note}</p>}
          </Card>

          <Card>
            <div className="mb-3 text-sm">
              <b>{picked.length}</b> questions · <b>{picked.length * marksPer}</b> marks · {duration} min
            </div>
            <ErrorNote>{error}</ErrorNote>
            <Button className="mt-3 w-full" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create exam"}
            </Button>
          </Card>
        </div>

        <Card>
          <CardTitle
            action={
              selected.length > 0 && (
                <button className="text-xs font-semibold text-brand" onClick={() => setSelected([])}>
                  Clear selection
                </button>
              )
            }
          >
            Questions · {subject}
          </CardTitle>
          {pool.length === 0 ? (
            <Empty>No questions for {subject} yet. Add some in the Question bank first.</Empty>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {chapters.map((c) => (
                  <Chip
                    key={c}
                    active={chapterFilter.includes(c)}
                    onClick={() => setChapterFilter((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]))}
                  >
                    {c}
                  </Chip>
                ))}
                <select className="field ml-auto w-auto py-1" value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)}>
                  <option value="">All difficulty</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <ul className="divide-y divide-line">
                {visible.map((q) => {
                  const on = selected.includes(q.id);
                  return (
                    <li key={q.id}>
                      <label className={cx("flex cursor-pointer gap-3 px-2 py-2.5", on && "bg-brand-soft/40")}>
                        <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(q.id)} />
                        <div className="min-w-0 flex-1 text-sm">
                          <MathText text={q.text} />
                          <div className="mt-0.5 text-xs text-muted">
                            {q.chapter} · {q.difficulty} · used in {q.usedIn || 0}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

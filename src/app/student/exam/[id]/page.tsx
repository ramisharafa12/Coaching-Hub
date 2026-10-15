"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MathText } from "@/components/MathText";
import { Badge, Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { cx, examDateLabel, ordinal } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];

interface Meta {
  id: string;
  title: string;
  subject: string;
  startAt: number;
  endsAt: number;
  durationMin: number;
  marksPerQuestion: number;
  negativeMark: number;
  totalMarks: number;
  questionCount: number;
  serverNow: number;
}
interface PaperQ {
  id: string;
  text: string;
  options: { i: number; text: string }[];
}
interface Result {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  rank?: number;
  outOf?: number;
}
interface Solution {
  id: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string;
  chapter: string;
  chosen: number | null;
}
type Resp =
  | { state: "scheduled"; exam: Meta }
  | { state: "live"; exam: Meta; paper: PaperQ[] }
  | { state: "submitted"; exam: Meta; result: Result }
  | { state: "ended"; exam: Meta; result: Result | null; solutions: Solution[] };

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // server time - device time

  const load = useCallback(async () => {
    try {
      const r = await api<Resp>(`/api/student/exams/${id}`);
      setOffset(r.exam.serverNow - Date.now());
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load exam");
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;

  if (data.state === "scheduled") return <Waiting exam={data.exam} offset={offset} onStart={load} />;
  if (data.state === "live") return <TakeExam exam={data.exam} paper={data.paper} offset={offset} onDone={load} />;
  if (data.state === "submitted") return <Submitted exam={data.exam} result={data.result} />;
  return <Review exam={data.exam} result={data.result} solutions={data.solutions} />;
}

function useNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 500);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function Waiting({ exam, offset, onStart }: { exam: Meta; offset: number; onStart: () => void }) {
  const now = useNow(offset);
  const left = exam.startAt - now;
  const started = useRef(false);
  useEffect(() => {
    if (left <= 0 && !started.current) {
      started.current = true;
      onStart();
    }
  }, [left, onStart]);
  return (
    <Card className="mx-auto max-w-md text-center">
      <Badge>Scheduled</Badge>
      <h1 className="mt-2 text-xl font-bold">{exam.title}</h1>
      <p className="text-sm text-muted">{examDateLabel(exam.startAt)}</p>
      <div className="my-6 text-4xl font-bold tabular-nums">{clock(left)}</div>
      <p className="text-sm text-muted">
        {exam.questionCount} questions · {exam.durationMin} min · −{exam.negativeMark} per wrong answer. The exam opens automatically.
      </p>
    </Card>
  );
}

function TakeExam({ exam, paper, offset, onDone }: { exam: Meta; paper: PaperQ[]; offset: number; onDone: () => void }) {
  const { api } = useAuth();
  const storageKey = `exam:${exam.id}`;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warning, setWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const autoTried = useRef(false);
  const now = useNow(offset);
  const left = exam.endsAt - now;

  // Restore progress after a refresh or a dropped connection
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        setAnswers(saved.answers || {});
        setCurrent(saved.current || 0);
        setTabSwitches(saved.tabSwitches || 0);
      }
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, current, tabSwitches }));
    } catch {
      /* storage unavailable */
    }
  }, [answers, current, tabSwitches, storageKey]);

  // Anti-cheating: count every time the student leaves the exam tab
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && !submittedRef.current) {
        setTabSwitches((n) => n + 1);
        setWarning(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      if (!auto) {
        const unanswered = paper.length - Object.keys(answers).length;
        const msg = unanswered ? `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?` : "Submit your exam?";
        if (!confirm(msg)) return;
      }
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        await api(`/api/student/exams/${exam.id}/submit`, { method: "POST", body: JSON.stringify({ answers, tabSwitches }) });
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        onDone();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Submit failed";
        if (/already submitted/i.test(message)) return onDone();
        submittedRef.current = false;
        setSubmitting(false);
        setError(`${message}. Check your internet and press Submit again — your answers are saved on this device.`);
      }
    },
    [answers, tabSwitches, api, exam.id, onDone, paper.length, storageKey]
  );

  // Auto-submit once when time runs out (if it fails, the student can press Submit again)
  useEffect(() => {
    if (left <= 0 && !autoTried.current) {
      autoTried.current = true;
      submit(true);
    }
  }, [left, submit]);

  const q = paper[current];
  const answered = Object.keys(answers).length;
  const lowTime = left < 60000;

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <aside className="order-2 lg:order-1">
        <Card className="lg:sticky lg:top-4">
          <div className="mb-3 text-sm font-semibold">Question palette</div>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {paper.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setCurrent(i)}
                className={cx(
                  "aspect-square rounded-lg border text-sm",
                  i === current
                    ? "border-brand bg-brand font-semibold text-white"
                    : answers[p.id] !== undefined
                      ? "border-brand/30 bg-brand-soft text-brand-dark"
                      : "border-line bg-white"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">
            Dark = current · Light green = answered
            <br />
            White = not answered
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => submit(false)} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        </Card>
      </aside>

      <section className="order-1 lg:order-2">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">{exam.title}</div>
            <div className="text-xs text-muted">{exam.subject}</div>
          </div>
          <span
            className={cx(
              "rounded-full px-3 py-1 text-sm font-bold tabular-nums",
              lowTime ? "animate-pulse bg-danger-soft text-danger" : "bg-warn-soft text-warn"
            )}
          >
            ⏱ {clock(left)}
          </span>
        </div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>
            Question {current + 1} of {paper.length}
          </span>
          <span>{answered} answered</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-brand transition-all" style={{ width: `${(answered / paper.length) * 100}%` }} />
        </div>

        {warning && (
          <div className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            You left the exam screen ({tabSwitches}×). Your teacher can see this.{" "}
            <button className="underline" onClick={() => setWarning(false)}>
              OK
            </button>
          </div>
        )}

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="green">Question {current + 1}</Badge>
            <span className="text-xs text-muted">
              {exam.marksPerQuestion} mark{exam.marksPerQuestion === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mb-4 text-[1.05rem] font-semibold leading-relaxed">
            <MathText text={q.text} />
          </div>
          <div className="space-y-2.5">
            {q.options.map((opt, pos) => {
              const chosen = answers[q.id] === opt.i;
              return (
                <button
                  key={opt.i}
                  onClick={() =>
                    setAnswers((a) => {
                      const next = { ...a };
                      if (chosen) delete next[q.id]; // tap again to clear
                      else next[q.id] = opt.i;
                      return next;
                    })
                  }
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                    chosen ? "border-2 border-brand bg-brand-soft/50" : "border-line hover:border-brand/40"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      chosen ? "bg-brand text-white" : "bg-mint text-text"
                    )}
                  >
                    {LETTERS[pos]}
                  </span>
                  <MathText text={opt.text} />
                </button>
              );
            })}
          </div>
        </Card>
        <p className="mt-2 text-xs text-muted">
          {exam.negativeMark} marks are deducted for each wrong answer. Tap a chosen option again to clear it.
        </p>

        <ErrorNote>{error}</ErrorNote>

        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
            Previous
          </Button>
          {current < paper.length - 1 ? (
            <Button className="flex-1" onClick={() => setCurrent((c) => c + 1)}>
              Next question
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => submit(false)} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit exam"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function ScoreCard({ exam, result }: { exam: Meta; result: Result }) {
  return (
    <Card className="text-center">
      <div className="text-sm text-muted">{exam.title}</div>
      <div className="my-3">
        <span className="text-5xl font-bold">{result.score}</span>
        <span className="text-lg text-muted"> / {exam.totalMarks}</span>
      </div>
      {result.rank && (
        <div className="mb-3 font-bold text-brand">
          {ordinal(result.rank)} in batch <span className="font-normal text-muted">out of {result.outOf}</span>
        </div>
      )}
      <div className="flex justify-center gap-6 text-sm">
        <span className="text-brand">✓ {result.correct} correct</span>
        <span className="text-danger">✗ {result.wrong} wrong</span>
        <span className="text-muted">— {result.skipped} skipped</span>
      </div>
    </Card>
  );
}

function Submitted({ exam, result }: { exam: Meta; result: Result }) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <ScoreCard exam={exam} result={result} />
      <p className="text-center text-sm text-muted">
        Submitted. Correct answers, explanations and your rank appear when the exam closes at{" "}
        {new Date(exam.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" })}.
      </p>
      <Link href="/student" className="block text-center text-sm font-semibold text-brand">
        Back to home
      </Link>
    </div>
  );
}

function Review({ exam, result, solutions }: { exam: Meta; result: Result | null; solutions: Solution[] }) {
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const list = solutions.filter((s) => filter === "all" || s.chosen !== s.answer);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {result ? <ScoreCard exam={exam} result={result} /> : <Card className="text-center text-sm text-muted">You didn&apos;t sit this exam. Here are the solutions.</Card>}
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Solutions</h2>
        <div className="flex gap-1 text-xs">
          {(["all", "wrong"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cx("rounded-full px-3 py-1", filter === f ? "bg-brand text-white" : "bg-white")}>
              {f === "all" ? "All" : "Wrong & skipped"}
            </button>
          ))}
        </div>
      </div>
      {list.map((s) => {
        const n = solutions.indexOf(s) + 1;
        const status = s.chosen === null ? "skipped" : s.chosen === s.answer ? "right" : "wrong";
        return (
          <Card key={s.id}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">
                <span className="text-muted">{n}. </span>
                <MathText text={s.text} />
              </div>
              <Badge tone={status === "right" ? "green" : status === "wrong" ? "red" : "gray"}>
                {status === "right" ? "Correct" : status === "wrong" ? "Wrong" : "Skipped"}
              </Badge>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {s.options.map((o, i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-lg border px-3 py-2 text-sm",
                    i === s.answer ? "border-brand bg-brand-soft/60 font-semibold" : i === s.chosen ? "border-danger/40 bg-danger-soft" : "border-line"
                  )}
                >
                  {LETTERS[i]}. <MathText text={o} />
                </div>
              ))}
            </div>
            {s.explanation && (
              <div className="mt-3 rounded-lg bg-mint px-3 py-2 text-sm">
                <MathText text={s.explanation} />
              </div>
            )}
            <div className="mt-2 text-xs text-muted">{s.chapter}</div>
          </Card>
        );
      })}
      <Link href="/student" className="block text-center text-sm font-semibold text-brand">
        Back to home
      </Link>
    </div>
  );
}

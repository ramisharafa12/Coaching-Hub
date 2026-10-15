"use client";

import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useMemo, useRef, useState } from "react";
import { MathText } from "@/components/MathText";
import { Button, Card, Empty, ErrorNote, Modal, PageHeader, Spinner } from "@/components/ui";
import { DIFFICULTIES, SUBJECTS } from "@/lib/config";
import { downloadTemplate, readRows, rowsToObjects } from "@/lib/excel";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/hooks";
import type { Difficulty, Question } from "@/lib/types";
import { cx } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];
const blank = { subject: SUBJECTS[0], chapter: "", difficulty: "Easy" as Difficulty, text: "", options: ["", "", "", ""], answer: 0, explanation: "" };

export default function QuestionBankPage() {
  const questions = useCollection<Question>("questions");
  const subjects = useMemo(() => {
    const set = new Set(SUBJECTS);
    questions.data.forEach((q) => set.add(q.subject));
    return [...set];
  }, [questions.data]);
  const firstWithData = subjects.find((s) => questions.data.some((q) => q.subject === s)) || SUBJECTS[0];

  const [subject, setSubject] = useState<string | null>(null);
  const activeSubject = subject ?? firstWithData;
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const inSubject = questions.data.filter((q) => q.subject === activeSubject);
  const chapters = [...new Set(inSubject.map((q) => q.chapter))].sort();
  const filtered = inSubject
    .filter((q) => !chapter || q.chapter === chapter)
    .filter((q) => !difficulty || q.difficulty === difficulty)
    .filter((q) => !search.trim() || q.text.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.createdAt - b.createdAt);

  function openNew() {
    setEditing(null);
    setForm({ ...blank, subject: activeSubject, chapter: chapter || "" });
    setError(null);
    setOpen(true);
  }
  function openEdit(q: Question) {
    setEditing(q);
    setForm({ subject: q.subject, chapter: q.chapter, difficulty: q.difficulty, text: q.text, options: [...q.options], answer: q.answer, explanation: q.explanation || "" });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return setError("Write the question.");
    if (!form.chapter.trim()) return setError("Add a chapter so analytics can find weak chapters.");
    if (form.options.some((o) => !o.trim())) return setError("Fill in all four options.");
    const data = { ...form, chapter: form.chapter.trim(), text: form.text.trim(), options: form.options.map((o) => o.trim()) };
    try {
      if (editing) await updateDoc(doc(db, "questions", editing.id), data);
      else await addDoc(collection(db, "questions"), { ...data, usedIn: 0, createdAt: Date.now() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function remove() {
    if (!editing || !confirm("Delete this question? Exams that already used it keep their copy.")) return;
    await deleteDoc(doc(db, "questions", editing.id));
    setOpen(false);
  }

  async function upload(file: File) {
    setUploadMsg("Reading file…");
    try {
      const objects = rowsToObjects(await readRows(file));
      const problems: string[] = [];
      const toAdd: Omit<Question, "id">[] = [];
      objects.forEach((o, i) => {
        const line = i + 2;
        const text = o["question"] || "";
        const options = ["option a", "option b", "option c", "option d"].map((k) => o[k] || "");
        const ansRaw = (o["answer"] || "").trim().toUpperCase();
        const answer = LETTERS.indexOf(ansRaw) >= 0 ? LETTERS.indexOf(ansRaw) : Number(ansRaw) - 1;
        const diff = DIFFICULTIES.find((d) => d.toLowerCase() === (o["difficulty"] || "easy").toLowerCase()) || "Easy";
        if (!text) return problems.push(`Row ${line}: missing question`);
        if (options.some((x) => !x)) return problems.push(`Row ${line}: needs 4 options`);
        if (!(answer >= 0 && answer <= 3)) return problems.push(`Row ${line}: answer must be A, B, C or D`);
        toAdd.push({
          subject: o["subject"] || activeSubject,
          chapter: o["chapter"] || "General",
          difficulty: diff,
          text,
          options,
          answer,
          explanation: o["explanation"] || "",
          usedIn: 0,
          createdAt: Date.now() + i, // keeps file order
        });
      });
      for (let i = 0; i < toAdd.length; i += 400) {
        const wb = writeBatch(db);
        toAdd.slice(i, i + 400).forEach((q) => wb.set(doc(collection(db, "questions")), q));
        await wb.commit();
      }
      setUploadMsg(
        `Added ${toAdd.length} question${toAdd.length === 1 ? "" : "s"}.` +
          (problems.length ? ` Skipped ${problems.length}:\n• ${problems.slice(0, 15).join("\n• ")}` : "")
      );
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : "Could not read that file. Use the .xlsx template.");
    }
  }

  function template() {
    downloadTemplate("question-bank-template.xlsx", [
      ["Subject", "Chapter", "Difficulty", "Question", "Option A", "Option B", "Option C", "Option D", "Answer", "Explanation"],
      [activeSubject, "Vectors", "Easy", "The dot product of two perpendicular vectors is", "1", "0", "AB", "Undefined", "B", "$AB\\cos 90^\\circ = 0$"],
      [activeSubject, "Dynamics", "Medium", "যদি $v = u + at$, $u=5$, $a=2$, $t=3$ হয়, তবে $v$ = ?", "6", "11", "15", "8", "B", "$5 + 2\\times3 = 11$"],
    ]);
  }

  if (questions.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Question bank"
        subtitle={`${activeSubject} · ${inSubject.length} questions`}
        actions={
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Upload Excel
            </Button>
            <Button onClick={openNew}>+ Add question</Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={cx(
          "mb-4 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm",
          dragging ? "border-brand bg-brand-soft/50" : "border-brand/30 bg-white/60"
        )}
      >
        <span className="text-brand-dark">Drag an Excel file (.xlsx) here to upload questions in bulk</span>
        <span className="text-muted"> · </span>
        <button className="font-semibold text-brand underline" onClick={template}>
          Download template
        </button>
        <div className="mt-1 text-xs text-muted">Bangla works as-is. Wrap math in $…$, e.g. $\frac{"{1}{2}"}mv^2$.</div>
      </div>
      {uploadMsg && (
        <Card className="mb-4 whitespace-pre-line text-sm">
          {uploadMsg}
          <button className="ml-3 text-xs text-muted underline" onClick={() => setUploadMsg(null)}>
            dismiss
          </button>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <select className="field w-auto bg-white" value={activeSubject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}>
          {subjects.map((s) => (
            <option key={s} value={s}>
              Subject: {s}
            </option>
          ))}
        </select>
        <select className="field w-auto bg-white" value={chapter} onChange={(e) => setChapter(e.target.value)}>
          <option value="">Chapter: All</option>
          {chapters.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="field w-auto bg-white" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Difficulty: All</option>
          {DIFFICULTIES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input className="field ml-auto max-w-xs bg-white" placeholder="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <Empty>No questions here yet. Upload an Excel file or add one by hand.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Chapter</th>
                  <th>Difficulty</th>
                  <th>Answer</th>
                  <th className="text-right">Used in</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => (
                  <tr key={q.id} className="cursor-pointer hover:bg-mint/60" onClick={() => openEdit(q)}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="max-w-md">
                      <div className="line-clamp-2">
                        <MathText text={q.text} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{q.chapter}</td>
                    <td className={cx("font-semibold", q.difficulty === "Easy" ? "text-brand" : q.difficulty === "Medium" ? "text-danger" : "text-[#6b21a8]")}>
                      {q.difficulty}
                    </td>
                    <td>{LETTERS[q.answer]}</td>
                    <td className="whitespace-nowrap text-right">{q.usedIn || 0} exams</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit question" : "Add question"} wide>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Subject</label>
              <select className="field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Chapter</label>
              <input className="field" list="chapters" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
              <datalist id="chapters">
                {chapters.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Difficulty</label>
              <select className="field" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Question (use $…$ for math)</label>
            <textarea className="field min-h-20" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            {form.text.includes("$") && (
              <div className="mt-2 rounded-lg bg-mint px-3 py-2 text-sm">
                <MathText text={form.text} />
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {form.options.map((opt, i) => (
              <label key={i} className={cx("flex items-center gap-2 rounded-lg border p-2", form.answer === i ? "border-brand bg-brand-soft/40" : "border-line")}>
                <input type="radio" name="answer" checked={form.answer === i} onChange={() => setForm({ ...form, answer: i })} />
                <span className="w-4 text-xs font-bold">{LETTERS[i]}</span>
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder={`Option ${LETTERS[i]}`}
                  value={opt}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm({ ...form, options });
                  }}
                />
              </label>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted">Select the radio button next to the correct option.</p>
          <div>
            <label className="label">Explanation (shown after the exam ends)</label>
            <textarea className="field min-h-16" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-between">
            {editing ? (
              <Button type="button" variant="danger" onClick={remove}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button>Save question</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

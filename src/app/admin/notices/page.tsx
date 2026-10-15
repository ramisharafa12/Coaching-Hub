"use client";

import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { Button, Card, CardTitle, Chip, Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useById, useCollection } from "@/lib/hooks";
import type { Batch, Notice, Student } from "@/lib/types";
import { formatShortDate, shortBatch } from "@/lib/utils";

export default function NoticesPage() {
  const batches = useCollection<Batch>("batches");
  const students = useCollection<Student>("students");
  const notices = useCollection<Notice>("notices");
  const batchMap = useById(batches.data);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const all = targets.includes("all");
  const recipients = students.data.filter((s) => all || targets.includes(s.batchId));

  function toggle(id: string) {
    if (id === "all") return setTargets(all ? [] : ["all"]);
    setTargets((t) => {
      const without = t.filter((x) => x !== "all");
      return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
    });
  }

  // Notices show in the student and guardian portals — free, so there is no SMS option.
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!title.trim()) return setError("Add a title.");
    if (!targets.length) return setError("Choose who gets it.");
    setSending(true);
    try {
      const n: Omit<Notice, "id"> = { title: title.trim(), message: message.trim(), batchIds: targets, viaApp: true, createdAt: Date.now() };
      await addDoc(collection(db, "notices"), n);
      setStatus(`Notice posted to ${recipients.length} student${recipients.length === 1 ? "" : "s"} and their guardians.`);
      setTitle("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  const recent = [...notices.data].sort((a, b) => b.createdAt - a.createdAt);

  if (batches.loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Notices" subtitle="Send updates to students and guardians" />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle>Compose notice</CardTitle>
          <form onSubmit={send} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="field" placeholder="Model Test 04 starts today at 9:00 AM" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="field min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div>
              <label className="label">Send to</label>
              <div className="flex flex-wrap gap-2">
                {batches.data.map((b) => (
                  <Chip key={b.id} active={all || targets.includes(b.id)} onClick={() => toggle(b.id)}>
                    {b.name}
                  </Chip>
                ))}
                <Chip active={all} onClick={() => toggle("all")}>
                  All batches
                </Chip>
              </div>
              {targets.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Shows in the portal of {recipients.length} student{recipients.length === 1 ? "" : "s"} and their guardians.
                </p>
              )}
            </div>
            <ErrorNote>{error}</ErrorNote>
            {status && <p className="text-sm text-brand">{status}</p>}
            <Button disabled={sending}>{sending ? "Posting…" : "Post notice"}</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Recent notices</CardTitle>
          {recent.length === 0 ? (
            <Empty>Nothing sent yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.slice(0, 20).map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex justify-between gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <button
                      className="shrink-0 text-xs text-danger"
                      onClick={() => confirm("Delete this notice?") && deleteDoc(doc(db, "notices", n.id))}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-xs text-muted">
                    {n.batchIds.includes("all") ? "All batches" : n.batchIds.map((id) => shortBatch(batchMap.get(id)?.name)).join(", ")} ·{" "}
                    {formatShortDate(n.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

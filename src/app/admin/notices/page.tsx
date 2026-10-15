"use client";

import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, CardTitle, Chip, Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { useById, useCollection } from "@/lib/hooks";
import type { Batch, Notice, Student } from "@/lib/types";
import { formatShortDate, shortBatch } from "@/lib/utils";

export default function NoticesPage() {
  const { api } = useAuth();
  const batches = useCollection<Batch>("batches");
  const students = useCollection<Student>("students");
  const notices = useCollection<Notice>("notices");
  const batchMap = useById(batches.data);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [viaApp, setViaApp] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const all = targets.includes("all");
  const recipients = students.data.filter((s) => all || targets.includes(s.batchId));
  const smsText = `${APP_NAME}: ${title.trim()}${message.trim() ? ` — ${message.trim()}` : ""}`;

  function toggle(id: string) {
    if (id === "all") return setTargets(all ? [] : ["all"]);
    setTargets((t) => {
      const without = t.filter((x) => x !== "all");
      return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!title.trim()) return setError("Add a title.");
    if (!targets.length) return setError("Choose who gets it.");
    if (!viaApp && !viaSms) return setError("Choose app, SMS, or both.");
    setSending(true);
    try {
      const n: Omit<Notice, "id"> = { title: title.trim(), message: message.trim(), batchIds: targets, viaApp, viaSms, createdAt: Date.now() };
      await addDoc(collection(db, "notices"), n);
      let smsNote = "";
      if (viaSms && recipients.length) {
        const r = await api<{ sent: number; mode: string }>("/api/sms", {
          method: "POST",
          body: JSON.stringify({ kind: "notice", messages: recipients.map((s) => ({ phone: s.guardianPhone, message: smsText })) }),
        });
        smsNote = r.mode === "log" ? ` Logged ${r.sent} SMS (SMS_PROVIDER=log).` : ` Sent ${r.sent} SMS.`;
      }
      setStatus(`Notice posted.${smsNote}`);
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
            </div>
            <div>
              <label className="label">Send via</label>
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={viaApp} onChange={(e) => setViaApp(e.target.checked)} /> App notice
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={viaSms} onChange={(e) => setViaSms(e.target.checked)} /> SMS to guardians
                </label>
              </div>
              {viaSms && targets.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {recipients.length} guardians · {smsText.length} characters
                  {/[^\x00-\x7F]/.test(smsText) ? " (Bangla SMS: ~70 characters per part)" : " (~160 characters per part)"}
                </p>
              )}
            </div>
            <ErrorNote>{error}</ErrorNote>
            {status && <p className="text-sm text-brand">{status}</p>}
            <Button disabled={sending}>{sending ? "Sending…" : "Send notice"}</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Recent notices</CardTitle>
          {recent.length === 0 ? (
            <Empty>Nothing sent yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.slice(0, 20).map((n) => (
                <li key={n.id} className="group py-3">
                  <div className="flex justify-between gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <button
                      className="hidden text-xs text-danger group-hover:block"
                      onClick={() => confirm("Delete this notice?") && deleteDoc(doc(db, "notices", n.id))}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-xs text-muted">
                    {n.batchIds.includes("all") ? "All batches" : n.batchIds.map((id) => shortBatch(batchMap.get(id)?.name)).join(", ")} ·{" "}
                    {formatShortDate(n.createdAt)} · {[n.viaApp && "App", n.viaSms && "SMS"].filter(Boolean).join(" + ")}
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

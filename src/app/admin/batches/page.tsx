"use client";

import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Button, Card, Empty, ErrorNote, Modal, PageHeader, Spinner } from "@/components/ui";
import { SESSION_LABEL, SUBJECTS } from "@/lib/config";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/hooks";
import type { Batch, Student } from "@/lib/types";
import { taka } from "@/lib/utils";

const blank = { name: "", subject: SUBJECTS[0], teacherName: "", schedule: "", fee: 1000 };

export default function BatchesPage() {
  const batches = useCollection<Batch>("batches");
  const students = useCollection<Student>("students");
  const [editing, setEditing] = useState<Batch | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    students.data.forEach((s) => m.set(s.batchId, (m.get(s.batchId) || 0) + 1));
    return m;
  }, [students.data]);

  const sorted = [...batches.data].sort((a, b) => a.name.localeCompare(b.name));

  function openNew() {
    setEditing(null);
    setForm(blank);
    setError(null);
    setOpen(true);
  }
  function openEdit(b: Batch) {
    setEditing(b);
    setForm({ name: b.name, subject: b.subject, teacherName: b.teacherName, schedule: b.schedule, fee: b.fee });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give the batch a name.");
    setSaving(true);
    try {
      const data = { ...form, name: form.name.trim(), fee: Number(form.fee) || 0 };
      if (editing) await updateDoc(doc(db, "batches", editing.id), data);
      else await addDoc(collection(db, "batches"), { ...data, createdAt: Date.now() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (counts.get(editing.id)) return setError("Move or remove this batch's students first.");
    if (!confirm(`Delete ${editing.name}?`)) return;
    await deleteDoc(doc(db, "batches", editing.id));
    setOpen(false);
  }

  if (batches.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle={`${SESSION_LABEL} · ${batches.data.length} batches`}
        actions={<Button onClick={openNew}>+ New batch</Button>}
      />
      <Card>
        {sorted.length === 0 ? (
          <Empty>No batches yet. Everything (students, exams, attendance, fees) is organized by batch, so start here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Teacher</th>
                  <th>Students</th>
                  <th>Schedule</th>
                  <th className="text-right">Fee / month</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">{b.name}</td>
                    <td>{b.teacherName}</td>
                    <td>{counts.get(b.id) || 0}</td>
                    <td className="whitespace-nowrap">{b.schedule}</td>
                    <td className="text-right">{taka(b.fee)}</td>
                    <td className="text-right">
                      <button className="text-xs font-semibold text-brand" onClick={() => openEdit(b)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit batch" : "New batch"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Batch name</label>
            <input className="field" placeholder="Physics 1st Paper · Morning A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject</label>
              <select className="field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Monthly fee (৳)</label>
              <input className="field" type="number" min={0} value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Teacher</label>
            <input className="field" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} />
          </div>
          <div>
            <label className="label">Schedule</label>
            <input className="field" placeholder="Sat, Mon, Wed · 7:00 AM" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-between gap-2">
            {editing ? (
              <Button type="button" variant="danger" onClick={remove}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button disabled={saving}>{saving ? "Saving…" : "Save batch"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

"use client";

import { addDoc, collection, deleteDoc, doc, updateDoc, where, writeBatch } from "firebase/firestore";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, ErrorNote, Modal, PageHeader, Spinner } from "@/components/ui";
import { db } from "@/lib/firebase";
import { downloadTemplate, readRows, rowsToObjects } from "@/lib/excel";
import { feeRows, type FeeStatus } from "@/lib/fees";
import { useById, useCollection } from "@/lib/hooks";
import type { AttendanceDoc, Batch, Payment, Student } from "@/lib/types";
import { dhakaDate, dhakaMonth, normalizeBdPhone, prettyPhone, shortBatch } from "@/lib/utils";

const blank = { name: "", roll: "", batchId: "", phone: "", guardianPhone: "", guardianName: "" };

export default function StudentsPage() {
  const month = dhakaMonth();
  const since = dhakaDate(Date.now() - 30 * 86400000);
  const students = useCollection<Student>("students");
  const batches = useCollection<Batch>("batches");
  const payments = useCollection<Payment>("payments", [where("month", "==", month)], month);
  const attendance = useCollection<AttendanceDoc>("attendance", [where("date", ">=", since)], since);
  const batchMap = useById(batches.data);

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [feeFilter, setFeeFilter] = useState<"" | FeeStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const attendancePct = useMemo(() => {
    const tally = new Map<string, { p: number; t: number }>();
    for (const a of attendance.data) {
      for (const [sid, v] of Object.entries(a.records)) {
        const t = tally.get(sid) || { p: 0, t: 0 };
        t.t++;
        if (v === "P") t.p++;
        tally.set(sid, t);
      }
    }
    return tally;
  }, [attendance.data]);

  const fees = useMemo(
    () => new Map(feeRows(students.data, batchMap, payments.data, month).map((r) => [r.student.id, r.status])),
    [students.data, batchMap, payments.data, month]
  );

  const filtered = students.data
    .filter((s) => !batchFilter || s.batchId === batchFilter)
    .filter((s) => !feeFilter || fees.get(s.id) === feeFilter)
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const digits = q.replace(/\D/g, "");
      return (
        s.name.toLowerCase().includes(q) ||
        s.roll.toLowerCase().includes(q) ||
        (digits.length >= 3 && (s.phone.includes(digits) || s.guardianPhone.includes(digits)))
      );
    })
    .sort((a, b) => a.roll.localeCompare(b.roll));

  function openNew() {
    setEditing(null);
    setForm({ ...blank, batchId: batchFilter || batches.data[0]?.id || "" });
    setError(null);
    setOpen(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      roll: s.roll,
      batchId: s.batchId,
      phone: s.phone.replace(/^\+88/, ""),
      guardianPhone: s.guardianPhone.replace(/^\+88/, ""),
      guardianName: s.guardianName || "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizeBdPhone(form.phone);
    const guardianPhone = normalizeBdPhone(form.guardianPhone);
    if (!form.name.trim()) return setError("Name is required.");
    if (!form.batchId) return setError("Pick a batch.");
    if (!phone) return setError("Student phone isn't a valid BD mobile number.");
    if (!guardianPhone) return setError("Guardian phone isn't a valid BD mobile number.");
    if (phone === guardianPhone) return setError("Student and guardian need different numbers — each logs in with their own.");
    const clash = students.data.find((s) => s.phone === phone && s.id !== editing?.id);
    if (clash) return setError(`${prettyPhone(phone)} already belongs to ${clash.name}.`);

    const data = {
      name: form.name.trim(),
      roll: form.roll.trim(),
      batchId: form.batchId,
      phone,
      guardianPhone,
      guardianName: form.guardianName.trim(),
    };
    try {
      if (editing) await updateDoc(doc(db, "students", editing.id), data);
      else await addDoc(collection(db, "students"), { ...data, createdAt: Date.now() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function remove() {
    if (!editing || !confirm(`Remove ${editing.name}? Their exam results stay in past exams.`)) return;
    await deleteDoc(doc(db, "students", editing.id));
    setOpen(false);
  }

  async function importExcel(file: File) {
    setImportMsg("Reading file…");
    try {
      const objects = rowsToObjects(await readRows(file));
      const byName = new Map<string, string>();
      batches.data.forEach((b) => {
        byName.set(b.name.toLowerCase(), b.id);
        byName.set(shortBatch(b.name).toLowerCase(), b.id);
      });
      const existingPhones = new Set(students.data.map((s) => s.phone));
      const problems: string[] = [];
      const toAdd: Omit<Student, "id">[] = [];
      objects.forEach((o, i) => {
        const line = i + 2;
        const name = o["name"] || o["student name"] || "";
        const batchId = byName.get((o["batch"] || "").toLowerCase());
        const phone = normalizeBdPhone(o["phone"] || o["student phone"]);
        const guardianPhone = normalizeBdPhone(o["guardian phone"]);
        if (!name) return problems.push(`Row ${line}: missing name`);
        if (!batchId) return problems.push(`Row ${line}: batch "${o["batch"]}" not found`);
        if (!phone) return problems.push(`Row ${line}: invalid student phone`);
        if (!guardianPhone) return problems.push(`Row ${line}: invalid guardian phone`);
        if (existingPhones.has(phone)) return problems.push(`Row ${line}: ${prettyPhone(phone)} already exists`);
        existingPhones.add(phone);
        toAdd.push({ name, roll: o["roll"] || "", batchId, phone, guardianPhone, guardianName: o["guardian name"] || "", createdAt: Date.now() });
      });
      for (let i = 0; i < toAdd.length; i += 400) {
        const wb = writeBatch(db);
        toAdd.slice(i, i + 400).forEach((s) => wb.set(doc(collection(db, "students")), s));
        await wb.commit();
      }
      setImportMsg(
        `Added ${toAdd.length} student${toAdd.length === 1 ? "" : "s"}.` +
          (problems.length ? ` Skipped ${problems.length}:\n• ${problems.slice(0, 15).join("\n• ")}` : "")
      );
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Could not read that file. Use the .xlsx template.");
    }
  }

  if (students.loading || batches.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${students.data.length} students · all batches`}
        actions={
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!batches.data.length}>
              Import Excel
            </Button>
            <Button onClick={openNew} disabled={!batches.data.length}>
              + Add student
            </Button>
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
          if (f) importExcel(f);
          e.target.value = "";
        }}
      />
      {importMsg && (
        <Card className="mb-4 whitespace-pre-line text-sm">
          {importMsg}
          <button className="ml-3 text-xs text-muted underline" onClick={() => setImportMsg(null)}>
            dismiss
          </button>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="field max-w-xs" placeholder="Search by name, roll or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field w-auto" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={feeFilter} onChange={(e) => setFeeFilter(e.target.value as FeeStatus | "")}>
            <option value="">All fees</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Due">Due</option>
          </select>
          <button
            className="ml-auto text-xs font-semibold text-brand"
            onClick={() =>
              downloadTemplate("students-template.xlsx", [
                ["Name", "Roll", "Batch", "Phone", "Guardian Phone", "Guardian Name"],
                ["Rafi Ahmed", "HSC26-014", batches.data[0]?.name || "Morning A", "01711000000", "01811000000", "Abdul Ahmed"],
              ])
            }
          >
            Download Excel template
          </button>
        </div>

        {!batches.data.length ? (
          <Empty>Create a batch first, then add students to it.</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No students match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll</th>
                  <th>Batch</th>
                  <th>Guardian phone</th>
                  <th>Attendance</th>
                  <th>Fees</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const att = attendancePct.get(s.id);
                  const fee = fees.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.name}</td>
                      <td>{s.roll}</td>
                      <td className="whitespace-nowrap">{shortBatch(batchMap.get(s.batchId)?.name)}</td>
                      <td className="whitespace-nowrap">{prettyPhone(s.guardianPhone)}</td>
                      <td>{att ? `${Math.round((att.p / att.t) * 100)}%` : "—"}</td>
                      <td>
                        <Badge tone={fee === "Paid" ? "green" : "yellow"}>{fee}</Badge>
                      </td>
                      <td className="text-right">
                        <button className="text-xs font-semibold text-brand" onClick={() => openEdit(s)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? editing.name : "Add student"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full name</label>
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Roll</label>
              <input className="field" placeholder="HSC26-014" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} />
            </div>
            <div>
              <label className="label">Batch</label>
              <select className="field" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                {batches.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Student phone (login)</label>
              <input className="field" inputMode="tel" placeholder="01711000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Guardian phone (login + SMS)</label>
              <input className="field" inputMode="tel" placeholder="01811000000" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Guardian name (optional)</label>
              <input className="field" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
            </div>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-between">
            {editing ? (
              <Button type="button" variant="danger" onClick={remove}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button>Save student</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

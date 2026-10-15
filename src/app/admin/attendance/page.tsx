"use client";

import { doc, setDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { useCollection, useDoc } from "@/lib/hooks";
import type { AttendanceDoc, Batch, Student } from "@/lib/types";
import { cx, dhakaDate } from "@/lib/utils";

export default function AttendancePage() {
  const { api } = useAuth();
  const batches = useCollection<Batch>("batches");
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(dhakaDate());
  const students = useCollection<Student>(batchId ? "students" : null, batchId ? [where("batchId", "==", batchId)] : [], batchId);
  const existing = useDoc<AttendanceDoc>(batchId ? `attendance/${batchId}_${date}` : null);
  const [records, setRecords] = useState<Record<string, "P" | "A">>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId && batches.data.length) setBatchId(batches.data[0].id);
  }, [batches.data, batchId]);

  // Load what was saved, or default everyone to Present
  useEffect(() => {
    if (existing.loading || students.loading) return;
    const base: Record<string, "P" | "A"> = {};
    students.data.forEach((s) => (base[s.id] = existing.data?.records[s.id] || "P"));
    setRecords(base);
    setSaved(!!existing.data);
    setMsg(null);
  }, [existing.data, existing.loading, students.data, students.loading]);

  const list = [...students.data].sort((a, b) => a.roll.localeCompare(b.roll));
  const absent = list.filter((s) => records[s.id] === "A");

  async function save() {
    setSaving(true);
    try {
      const data: Omit<AttendanceDoc, "id"> = { batchId, date, records, updatedAt: Date.now() };
      await setDoc(doc(db, "attendance", `${batchId}_${date}`), data);
      setSaved(true);
      setMsg("Saved.");
    } finally {
      setSaving(false);
    }
  }

  async function smsAbsent() {
    if (!absent.length) return;
    const batchName = batches.data.find((b) => b.id === batchId)?.name || "";
    try {
      const r = await api<{ sent: number; mode: string }>("/api/sms", {
        method: "POST",
        body: JSON.stringify({
          kind: "absent",
          messages: absent.map((s) => ({
            phone: s.guardianPhone,
            message: `${APP_NAME}: ${s.name} আজ (${date}) ${batchName} ক্লাসে অনুপস্থিত ছিল।`,
          })),
        }),
      });
      setMsg(r.mode === "log" ? `Logged ${r.sent} absence SMS (SMS_PROVIDER=log).` : `Sent ${r.sent} absence SMS.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SMS failed");
    }
  }

  if (batches.loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Tap a name to switch between Present and Absent" />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="field w-auto bg-white" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          {batches.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input className="field w-auto bg-white" type="date" value={date} max={dhakaDate()} onChange={(e) => setDate(e.target.value)} />
      </div>

      <Card>
        {!batchId ? (
          <Empty>Create a batch first.</Empty>
        ) : students.loading || existing.loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty>No students in this batch.</Empty>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span>
                <b>{list.length - absent.length}</b> present · <b className="text-danger">{absent.length}</b> absent
              </span>
              <span className="text-xs text-muted">{saved ? "· saved" : "· not saved yet"}</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRecords(Object.fromEntries(list.map((s) => [s.id, "P"])))}>
                  All present
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save attendance"}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => {
                const a = records[s.id] === "A";
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setRecords((r) => ({ ...r, [s.id]: a ? "P" : "A" }));
                      setSaved(false);
                    }}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      a ? "border-warn/40 bg-warn-soft" : "border-line bg-white hover:border-brand/40"
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        a ? "border border-warn bg-warn-soft text-warn" : "bg-brand-soft text-brand-dark"
                      )}
                    >
                      {a ? "A" : "P"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="text-xs text-muted">{s.roll}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {saved && absent.length > 0 && (
                <Button variant="outline" onClick={smsAbsent}>
                  SMS guardians of {absent.length} absent
                </Button>
              )}
              {msg && <span className="text-sm text-muted">{msg}</span>}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

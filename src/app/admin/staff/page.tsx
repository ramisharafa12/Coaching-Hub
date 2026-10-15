"use client";

import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, CardTitle, Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/hooks";
import type { UserDoc } from "@/lib/types";

interface Invite {
  id: string; // email
  role: "admin" | "teacher";
  name?: string;
  createdAt: number;
  acceptedAt?: number;
}

export default function StaffPage() {
  const { profile, user } = useAuth();
  const users = useCollection<UserDoc & { id: string }>("users");
  const invites = useCollection<Invite>("staffInvites");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [error, setError] = useState<string | null>(null);

  if (profile?.role !== "admin") return <Empty>Only admins can manage staff.</Empty>;
  if (users.loading) return <Spinner />;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError("Enter a valid email.");
    setError(null);
    await setDoc(doc(db, "staffInvites", clean), { role, name: name.trim(), createdAt: Date.now() });
    setEmail("");
    setName("");
  }

  const pending = invites.data.filter((i) => !i.acceptedAt);

  return (
    <>
      <PageHeader title="Staff" subtitle="Teachers and admins who can use the dashboard" />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardTitle>Invite a teacher</CardTitle>
          <form onSubmit={invite} className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="field" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "admin")}>
                <option value="teacher">Teacher — exams, questions, attendance, notices, fees</option>
                <option value="admin">Admin — everything, plus staff and deleting results</option>
              </select>
            </div>
            <ErrorNote>{error}</ErrorNote>
            <Button>Add invite</Button>
            <p className="text-xs text-muted">
              They sign in on the login page with this email (Google or email + password). After verifying their email they get access automatically.
            </p>
          </form>
        </Card>

        <Card>
          <CardTitle>Team</CardTitle>
          <ul className="divide-y divide-line">
            {users.data.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.name || u.email}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="field w-auto py-1 text-xs"
                    value={u.role}
                    disabled={u.id === user?.uid}
                    onChange={(e) => updateDoc(doc(db, "users", u.id), { role: e.target.value })}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                  {u.id !== user?.uid && (
                    <button
                      className="text-xs text-danger"
                      onClick={async () => {
                        if (!confirm(`Remove ${u.email}'s access?`)) return;
                        await deleteDoc(doc(db, "users", u.id));
                        await deleteDoc(doc(db, "staffInvites", u.email)).catch(() => undefined);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{i.name || i.id}</div>
                  <div className="text-xs text-muted">{i.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="yellow">Invited · {i.role}</Badge>
                  <button className="text-xs text-danger" onClick={() => deleteDoc(doc(db, "staffInvites", i.id))}>
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

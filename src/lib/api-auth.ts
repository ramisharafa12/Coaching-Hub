import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import type { Role, Student, UserDoc } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      const message = err instanceof Error ? err.message : "Server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export async function verifyRequest(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Not signed in");
  const authAdmin = adminAuth(); // throws a clear setup error if the service account env vars are missing
  try {
    return await authAdmin.verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface Identity {
  uid: string;
  role: Role;
  email?: string;
  phone?: string;
  name?: string;
  reason?: string; // why role is "none"
  student?: Student; // when role = student
  children?: Student[]; // when role = guardian
}

/** Custom-token claim carrying a student's or guardian's verified phone number. */
export const PHONE_CLAIM = "ch_phone";

async function studentsWhere(field: "phone" | "guardianPhone", phone: string): Promise<Student[]> {
  const snap = await adminDb().collection("students").where(field, "==", phone).get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Student, "id">), id: d.id }));
}

/** True when the number is some student's own phone or a guardian phone. */
export async function isRegisteredPhone(phone: string): Promise<boolean> {
  const students = adminDb().collection("students");
  const [own, guardian] = await Promise.all([
    students.where("phone", "==", phone).limit(1).get(),
    students.where("guardianPhone", "==", phone).limit(1).get(),
  ]);
  return !own.empty || !guardian.empty;
}

/** Work out who the signed-in person is. Staff are created here on first login. */
export async function resolveIdentity(token: DecodedIdToken): Promise<Identity> {
  const db = adminDb();
  const uid = token.uid;

  // Phone + PIN sign-in → student or guardian, matched by the numbers the center entered.
  // The verified number rides in the custom token our own /api/auth/pin-login issued.
  const phone = typeof token[PHONE_CLAIM] === "string" ? (token[PHONE_CLAIM] as string) : "";
  if (phone) {
    const asStudent = await studentsWhere("phone", phone);
    if (asStudent.length) {
      return { uid, role: "student", phone, name: asStudent[0].name, student: asStudent[0] };
    }
    const children = await studentsWhere("guardianPhone", phone);
    if (children.length) {
      return { uid, role: "guardian", phone, name: children[0].guardianName || "Guardian", children };
    }
    return {
      uid,
      role: "none",
      phone,
      reason: "This number isn't registered with any student. Ask your coaching center to add it.",
    };
  }

  // Email / Google sign-in → staff.
  const email = (token.email || "").toLowerCase();
  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    const u = existing.data() as UserDoc;
    return { uid, role: u.role, email, name: u.name || email };
  }

  if (!email) return { uid, role: "none", reason: "No email or phone on this account." };
  if (!token.email_verified) {
    return { uid, role: "none", email, reason: "verify_email" };
  }

  if (adminEmails().includes(email)) {
    const doc: UserDoc = { role: "admin", email, name: token.name || email, createdAt: Date.now() };
    await userRef.set(doc);
    return { uid, role: "admin", email, name: doc.name };
  }

  const inviteRef = db.collection("staffInvites").doc(email);
  const invite = await inviteRef.get();
  if (invite.exists) {
    const role = (invite.data()?.role as UserDoc["role"]) || "teacher";
    const doc: UserDoc = { role, email, name: invite.data()?.name || token.name || email, createdAt: Date.now() };
    await userRef.set(doc);
    await inviteRef.update({ acceptedAt: Date.now(), uid });
    return { uid, role, email, name: doc.name };
  }

  return {
    uid,
    role: "none",
    email,
    reason: "This email hasn't been invited. Ask the center admin to add you under Staff.",
  };
}

export async function requireStaff(req: Request): Promise<Identity> {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "admin" && id.role !== "teacher") throw new HttpError(403, "Staff only");
  return id;
}

export async function requireAdmin(req: Request): Promise<Identity> {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "admin") throw new HttpError(403, "Admins only");
  return id;
}

export async function requireStudent(req: Request): Promise<Student> {
  const id = await resolveIdentity(await verifyRequest(req));
  if (id.role !== "student" || !id.student) throw new HttpError(403, "Students only");
  return id.student;
}

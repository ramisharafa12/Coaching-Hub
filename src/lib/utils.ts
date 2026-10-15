import { SUBMIT_GRACE_SECONDS, TIME_ZONE } from "./config";
import type { Exam, ExamState, Student } from "./types";

/** Normalize a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX). Returns "" if invalid. */
export function normalizeBdPhone(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  let digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(3);
  else if (digits.startsWith("88")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  if (!/^01[3-9]\d{8}$/.test(digits)) return "";
  return "+88" + digits;
}

/**
 * A student and a guardian each log in with their own number, and the server tells them apart
 * by it, so a number may be a student's own phone or a guardian phone, never both.
 * (One guardian phone may cover several children.) Returns a message, or null when it's fine.
 */
export function phoneClash(
  students: Pick<Student, "id" | "name" | "phone" | "guardianPhone">[],
  s: { id?: string; phone: string; guardianPhone: string }
): string | null {
  if (s.phone === s.guardianPhone) return "Student and guardian need different numbers — each logs in with their own.";
  for (const o of students) {
    if (o.id === s.id) continue;
    if (o.phone === s.phone) return `${prettyPhone(s.phone)} already belongs to ${o.name}.`;
    if (o.guardianPhone === s.phone) return `${prettyPhone(s.phone)} is already ${o.name}'s guardian number.`;
    if (o.phone === s.guardianPhone) return `${prettyPhone(s.guardianPhone)} is ${o.name}'s own number, so it can't be a guardian number.`;
  }
  return null;
}

/** +8801711000000 -> 01711-000000 */
export function prettyPhone(e164: string): string {
  const local = e164.replace(/^\+88/, "");
  return local.length === 11 ? `${local.slice(0, 5)}-${local.slice(5)}` : e164;
}

/** Taka with South Asian digit grouping: ৳2,52,000 */
export function taka(n: number): string {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

/** Today's date (or a given time) as YYYY-MM-DD in Dhaka time. */
export function dhakaDate(ms: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** YYYY-MM in Dhaka time. */
export function dhakaMonth(ms: number = Date.now()): string {
  return dhakaDate(ms).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
}

/** Exam date label in the mockup style: "Today · 9:00 AM" / "Sat 10 Oct · 8:30 AM" */
export function examDateLabel(ms: number): string {
  const time = new Date(ms).toLocaleString("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true });
  if (dhakaDate(ms) === dhakaDate()) return `Today · ${time}`;
  const day = new Date(ms).toLocaleString("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  return `${day.replace(",", "")} · ${time}`;
}

/** Convert a Dhaka-local "YYYY-MM-DDTHH:mm" (from <input type="datetime-local">) to epoch ms. */
export function dhakaLocalToMs(local: string): number {
  // Bangladesh has no daylight saving: always UTC+06:00.
  return new Date(`${local}:00+06:00`).getTime();
}

export function msToDhakaLocal(ms: number): string {
  const d = new Date(ms + 6 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function examEndsAt(exam: Pick<Exam, "startAt" | "durationMin">): number {
  return exam.startAt + exam.durationMin * 60 * 1000;
}

/** When answers and solutions may be shown: after the late-submit grace window has closed too. */
export function solutionsAt(exam: Pick<Exam, "startAt" | "durationMin">): number {
  return examEndsAt(exam) + SUBMIT_GRACE_SECONDS * 1000;
}

export function examState(exam: Pick<Exam, "startAt" | "durationMin">, now = Date.now()): ExamState {
  if (now < exam.startAt) return "scheduled";
  if (now < examEndsAt(exam)) return "live";
  return "ended";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Deterministic shuffling (same student + exam always gets the same order) ──

function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = seededRandom(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** "Physics 1st Paper · Morning A" -> "Morning A" */
export function shortBatch(name?: string): string {
  if (!name) return "—";
  const parts = name.split("·");
  return parts[parts.length - 1].trim();
}

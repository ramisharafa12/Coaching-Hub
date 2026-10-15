// Firestore data model. All times are stored as epoch milliseconds (numbers)
// so the same values work in the browser SDK and the Admin SDK.

export type Role = "admin" | "teacher" | "student" | "guardian" | "none";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Batch {
  id: string;
  name: string; // "Physics 1st Paper · Morning A"
  subject: string;
  teacherName: string;
  schedule: string; // "Sat, Mon, Wed · 7:00 AM"
  fee: number; // monthly fee in taka
  createdAt: number;
}

export interface Student {
  id: string;
  name: string;
  roll: string;
  batchId: string;
  phone: string; // E.164, e.g. +8801711000000 — student's own login
  guardianPhone: string; // E.164 — guardian's login and SMS number
  guardianName?: string;
  createdAt: number;
}

export interface Question {
  id: string;
  subject: string;
  chapter: string;
  difficulty: Difficulty;
  text: string; // supports $...$ KaTeX
  options: string[]; // exactly 4
  answer: number; // 0-3
  explanation?: string;
  usedIn: number;
  createdAt: number;
}

// Snapshot of a question stored inside the exam, so later edits to the bank
// don't change results of exams that already happened.
export interface ExamQuestion {
  id: string;
  text: string;
  options: string[];
  answer: number;
  explanation?: string;
  chapter: string;
  difficulty: Difficulty;
}

export interface Exam {
  id: string;
  title: string;
  batchId: string;
  subject: string;
  startAt: number;
  durationMin: number;
  marksPerQuestion: number;
  negativeMark: number; // deducted per wrong answer, e.g. 0.25
  questions: ExamQuestion[];
  totalMarks: number;
  submittedCount: number;
  scoreSum: number;
  createdAt: number;
}

export interface Submission {
  studentId: string;
  studentName: string;
  roll: string;
  answers: Record<string, number>; // questionId -> chosen original option index
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  tabSwitches: number;
  submittedAt: number;
}

export interface AttendanceDoc {
  id: string; // `${batchId}_${date}`
  batchId: string;
  date: string; // YYYY-MM-DD in Asia/Dhaka
  records: Record<string, "P" | "A">; // studentId -> status
  updatedAt: number;
}

export interface Payment {
  id: string;
  studentId: string;
  batchId: string;
  month: string; // YYYY-MM
  amount: number;
  method: "bKash" | "Nagad" | "Cash" | "Bank";
  reference?: string;
  createdAt: number;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  batchIds: string[]; // ["all"] for every batch
  viaApp: boolean;
  viaSms: boolean;
  createdAt: number;
}

export interface UserDoc {
  role: "admin" | "teacher";
  email: string;
  name?: string;
  createdAt: number;
}

export type ExamState = "scheduled" | "live" | "ended";

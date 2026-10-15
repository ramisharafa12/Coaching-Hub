"use client";

import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Batch, Difficulty, Exam, ExamQuestion, Notice, Payment, Question, Student } from "./types";
import { dhakaMonth } from "./utils";

/**
 * Fills an empty project with sample data that matches the mockups, so you can
 * click around immediately. Student 01700000001 and guardian 01800000001 can log
 * in once you add them as Firebase test phone numbers (see README).
 */
export async function loadDemoData() {
  const now = Date.now();
  const wb = writeBatch(db);

  const batches: Omit<Batch, "id">[] = [
    { name: "Physics 1st Paper · Morning A", subject: "Physics 1st Paper", teacherName: "Md. Rakibul Hasan", schedule: "Sat, Mon, Wed · 7:00 AM", fee: 1200, createdAt: now },
    { name: "Physics 1st Paper · Evening B", subject: "Physics 1st Paper", teacherName: "Md. Rakibul Hasan", schedule: "Sun, Tue, Thu · 5:00 PM", fee: 1200, createdAt: now },
    { name: "Higher Math 1st Paper · Morning B", subject: "Higher Math 1st Paper", teacherName: "Nusrat Jahan", schedule: "Sat, Mon, Wed · 8:30 AM", fee: 1500, createdAt: now },
    { name: "Chemistry 1st Paper · Morning A", subject: "Chemistry 1st Paper", teacherName: "Sumaiya Akter", schedule: "Sun, Tue, Thu · 7:00 AM", fee: 1200, createdAt: now },
    { name: "Biology 1st Paper · Evening A", subject: "Biology 1st Paper", teacherName: "Dr. Tanvir Ahmed", schedule: "Sat, Mon, Wed · 5:00 PM", fee: 1000, createdAt: now },
    { name: "English · Morning C", subject: "English", teacherName: "Farhana Rahman", schedule: "Sun, Tue, Thu · 9:30 AM", fee: 800, createdAt: now },
  ];
  const batchIds = batches.map((b) => {
    const ref = doc(collection(db, "batches"));
    wb.set(ref, b);
    return ref.id;
  });
  const physicsA = batchIds[0];

  const names = [
    "Rafi Ahmed", "Tania Islam", "Sakib Hasan", "Ayesha Siddika", "Imran Hossain", "Farzana Yeasmin",
    "Mehedi Hasan", "Nusrat Jahan Mim", "Arif Rahman", "Sadia Afrin", "Tanvir Alam", "Jannatul Ferdous",
  ];
  const studentIds: string[] = [];
  names.forEach((name, i) => {
    const ref = doc(collection(db, "students"));
    const n = String(i + 1).padStart(2, "0");
    const s: Omit<Student, "id"> = {
      name,
      roll: `HSC26-${String(10 + i * 3).padStart(3, "0")}`,
      batchId: i < 8 ? physicsA : batchIds[(i % 5) + 1],
      phone: `+88017000000${n}`,
      guardianPhone: `+88018000000${n}`,
      guardianName: `Guardian of ${name.split(" ")[0]}`,
      createdAt: now,
    };
    wb.set(ref, s);
    studentIds.push(ref.id);
  });

  const qs: [string, Difficulty, string, string[], number, string][] = [
    ["Dynamics", "Easy", "A body is thrown vertically upward at 20 m/s. What is its velocity at the maximum height?", ["0 m/s", "10 m/s", "20 m/s", "9.8 m/s"], 0, "At the highest point the body momentarily stops, so $v = 0$."],
    ["Vectors", "Easy", "The dot product of two perpendicular vectors is:", ["1", "0", "Product of magnitudes", "Undefined"], 1, "$\\vec A \\cdot \\vec B = AB\\cos 90^\\circ = 0$"],
    ["Newtonian Mechanics", "Medium", "The SI unit of angular momentum is:", ["kg m s⁻²", "kg m² s⁻²", "kg m² s⁻¹", "N m"], 2, "$L = I\\omega$ → kg m² × s⁻¹."],
    ["Gravitation", "Medium", "The escape velocity from the Earth's surface is about:", ["7.9 km/s", "9.8 km/s", "11.2 km/s", "3 km/s"], 2, "$v_e = \\sqrt{2gR} \\approx 11.2$ km/s."],
    ["Work, Energy and Power", "Medium", "Work done by the centripetal force on a body in uniform circular motion is:", ["Zero", "Positive", "Negative", "Depends on speed"], 0, "Force is perpendicular to displacement at every instant."],
    ["Vectors", "Easy", "Which of the following is a scalar quantity?", ["Velocity", "Force", "Displacement", "Work"], 3, "Work is the dot product of two vectors, so it is scalar."],
    ["Dynamics", "Medium", "If $v = u + at$ with $u = 5$ m/s, $a = 2$ m/s², what is $v$ after 3 s?", ["6 m/s", "11 m/s", "15 m/s", "8 m/s"], 1, "$v = 5 + 2 \\times 3 = 11$ m/s."],
    ["Newtonian Mechanics", "Hard", "A 2 kg mass moving at 3 m/s collides and sticks to a 1 kg mass at rest. Final speed?", ["1 m/s", "1.5 m/s", "2 m/s", "3 m/s"], 2, "Momentum: $2 \\times 3 = 3v \\Rightarrow v = 2$ m/s."],
    ["Gravitation", "Easy", "পৃথিবীর পৃষ্ঠে অভিকর্ষজ ত্বরণের মান প্রায় কত?", ["9.8 m/s²", "1.6 m/s²", "3.7 m/s²", "24.8 m/s²"], 0, "পৃথিবীতে $g \\approx 9.8$ m/s²।"],
    ["Work, Energy and Power", "Hard", "A 60 kg person climbs 10 m in 20 s. Average power? ($g = 10$ m/s²)", ["30 W", "300 W", "600 W", "3000 W"], 1, "$P = mgh/t = 60 \\times 10 \\times 10 / 20 = 300$ W."],
    ["Vectors", "Medium", "The magnitude of $\\hat i + \\hat j + \\hat k$ is:", ["1", "$\\sqrt 2$", "$\\sqrt 3$", "3"], 2, "$\\sqrt{1^2+1^2+1^2} = \\sqrt3$"],
    ["Dynamics", "Hard", "A ball dropped from 45 m. Time to reach the ground? ($g = 10$ m/s²)", ["2 s", "3 s", "4.5 s", "9 s"], 1, "$h = \\tfrac12 g t^2 \\Rightarrow t = 3$ s."],
  ];
  const examQuestions: ExamQuestion[] = [];
  qs.forEach(([chapter, difficulty, text, options, answer, explanation]) => {
    const ref = doc(collection(db, "questions"));
    const q: Omit<Question, "id"> = { subject: "Physics 1st Paper", chapter, difficulty, text, options, answer, explanation, usedIn: 1, createdAt: now };
    wb.set(ref, q);
    examQuestions.push({ id: ref.id, text, options, answer, explanation, chapter, difficulty });
  });

  // One exam live right now (open for 60 minutes) and one scheduled for later.
  const live: Omit<Exam, "id"> = {
    title: "Model Test 04 · Physics",
    batchId: physicsA,
    subject: "Physics 1st Paper",
    startAt: now - 60 * 1000,
    durationMin: 60,
    marksPerQuestion: 1,
    negativeMark: 0.25,
    questions: examQuestions.slice(0, 10),
    totalMarks: 10,
    submittedCount: 0,
    scoreSum: 0,
    createdAt: now,
  };
  wb.set(doc(collection(db, "exams")), live);
  const scheduled: Omit<Exam, "id"> = {
    ...live,
    title: "Chapter Test · Vectors",
    startAt: now + 2 * 86400000,
    durationMin: 15,
    questions: examQuestions.filter((q) => q.chapter === "Vectors"),
    totalMarks: examQuestions.filter((q) => q.chapter === "Vectors").length,
  };
  wb.set(doc(collection(db, "exams")), scheduled);

  // A few payments this month
  const month = dhakaMonth(now);
  [3, 5].forEach((i) => {
    const p: Omit<Payment, "id"> = { studentId: studentIds[i], batchId: physicsA, month, amount: 1200, method: "bKash", reference: `8N7A5K2Q${i}D`, createdAt: now };
    wb.set(doc(collection(db, "payments")), p);
  });
  const partial: Omit<Payment, "id"> = { studentId: studentIds[4], batchId: physicsA, month, amount: 600, method: "Cash", createdAt: now };
  wb.set(doc(collection(db, "payments")), partial);

  const notice: Omit<Notice, "id"> = {
    title: "Model Test 04 is live now",
    message: "10 questions, 0.25 negative marking. Open the app and start from Exams.",
    batchIds: [physicsA],
    viaApp: true,
    viaSms: false,
    createdAt: now,
  };
  wb.set(doc(collection(db, "notices")), notice);

  await wb.commit();
}

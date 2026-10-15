// One place to rename the app. Set NEXT_PUBLIC_APP_NAME in .env / Vercel to change it.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Coaching Hub";
export const SESSION_LABEL = process.env.NEXT_PUBLIC_SESSION_LABEL || "HSC 26";
export const TIME_ZONE = "Asia/Dhaka";

// Seconds of grace after an exam ends during which a late auto-submit is still accepted
// (covers slow connections in the last moments).
export const SUBMIT_GRACE_SECONDS = 90;

export const SUBJECTS = [
  "Physics 1st Paper",
  "Physics 2nd Paper",
  "Chemistry 1st Paper",
  "Chemistry 2nd Paper",
  "Higher Math 1st Paper",
  "Higher Math 2nd Paper",
  "Biology 1st Paper",
  "Biology 2nd Paper",
  "Bangla",
  "English",
  "ICT",
];

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

/**
 * Server-side: whether guardians may use the demo online checkout. It records a payment marked
 * "Demo" and moves no real money. On unless DEMO_PAYMENTS=false.
 */
export function demoPaymentsEnabled(): boolean {
  return process.env.DEMO_PAYMENTS !== "false";
}

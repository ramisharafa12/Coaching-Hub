// Creates the local admin account in the Firebase Auth emulator, already email-verified,
// so you can sign in without a real inbox. Emulator only — it refuses to touch a real project.
//
//   npm run seed:admin
//
// Uses the first address in ADMIN_EMAILS and LOCAL_ADMIN_PASSWORD from .env.local.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host) {
  console.error("FIREBASE_AUTH_EMULATOR_HOST is not set. This script only works against the local emulators (see .env.example).");
  process.exit(1);
}

const email = (process.env.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
const password = process.env.LOCAL_ADMIN_PASSWORD || "";
if (!email || password.length < 6) {
  console.error("Set ADMIN_EMAILS and LOCAL_ADMIN_PASSWORD (6+ characters) in .env.local first.");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-coaching";
const auth = getAuth(initializeApp({ projectId }));

try {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (user) {
    await auth.updateUser(user.uid, { password, emailVerified: true });
    console.log(`Updated local admin ${email} (emulator at ${host}).`);
  } else {
    await auth.createUser({ email, password, emailVerified: true, displayName: "Center Admin" });
    console.log(`Created local admin ${email} (emulator at ${host}).`);
  }
  console.log("Sign in at http://localhost:3000/login → Teacher / Admin, with the password from .env.local.");
} catch (err) {
  console.error("Could not reach the Auth emulator. Is `npm run emulators` running?\n", err.message);
  process.exit(1);
}

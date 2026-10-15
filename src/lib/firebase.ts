"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** False when the NEXT_PUBLIC_FIREBASE_* variables haven't been set. */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// The SDK only runs in the browser. During the server prerender these stay null,
// which is fine because every page touches them only inside effects and handlers.
const inBrowser = typeof window !== "undefined" && firebaseConfigured;
const app = inBrowser ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

export const auth = (app ? getAuth(app) : null) as Auth;
export const db = (app ? getFirestore(app) : null) as Firestore;

// Local development against the Firebase Emulator Suite (free; phone OTP codes show in the emulator UI).
if (app && process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
  const g = globalThis as { __emulatorsConnected?: boolean };
  if (!g.__emulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    g.__emulatorsConnected = true;
  }
}

"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeForRole, useAuth } from "@/components/AuthProvider";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { auth } from "@/lib/firebase";
import { cx, normalizeBdPhone } from "@/lib/utils";

type Mode = "phone" | "staff";

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  const map: Record<string, string> = {
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with this email. Create one first.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/weak-password": "Use at least 6 characters for the password.",
    "auth/popup-closed-by-user": "Google sign-in was closed.",
  };
  return map[code] || (e instanceof Error ? e.message : "Something went wrong");
}

export default function LoginPage() {
  const { user, profile, loading, error: authError, signOut, refresh } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // phone + PIN
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  // staff
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.role !== "none") router.replace(homeForRole(profile.role));
  }, [loading, profile, router]);

  // The server checks the PIN and hands back a custom token — free, no SMS involved.
  async function pinLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalizeBdPhone(phone)) return setError("Enter a valid Bangladeshi mobile number, e.g. 01711000000");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || `Sign-in failed (${res.status})`);
      await signInWithCustomToken(auth, data.token);
      setPin("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function staffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (creating) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        setInfo("Account created. We emailed you a verification link — open it, then come back and press “I've verified”.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) return setError("Type your email first.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Password reset email sent.");
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (loading) return <Spinner />;

  // Signed in but no role yet
  if (user && profile?.role === "none") {
    const needsVerify = profile.reason === "verify_email";
    return (
      <Shell>
        <h2 className="text-lg font-bold">{needsVerify ? "Verify your email" : "Access not set up yet"}</h2>
        <p className="mt-2 text-sm text-muted">
          {needsVerify
            ? `Open the verification link we sent to ${profile.email}, then press the button below.`
            : profile.reason}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {needsVerify && (
            <>
              <Button onClick={refresh}>I&apos;ve verified</Button>
              <Button variant="outline" onClick={() => user && sendEmailVerification(user).then(() => setInfo("Sent again."))}>
                Resend link
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={signOut}>
            Use another account
          </Button>
        </div>
        {info && <p className="mt-3 text-sm text-brand">{info}</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-mint p-1 text-sm font-semibold">
        {(["phone", "staff"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={cx("rounded-lg py-2", mode === m ? "bg-white shadow-sm" : "text-muted")}
          >
            {m === "phone" ? "Student / Guardian" : "Teacher / Admin"}
          </button>
        ))}
      </div>

      {mode === "phone" ? (
        <form onSubmit={pinLogin} className="space-y-4">
          <div>
            <label className="label">Mobile number</label>
            <input
              className="field"
              inputMode="tel"
              autoComplete="username"
              placeholder="01711 000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted">Use the number your coaching center registered. No Gmail needed.</p>
          </div>
          <div>
            <label className="label">6-digit PIN</label>
            <input
              className="field text-center text-lg tracking-[0.4em]"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
            <p className="mt-1.5 text-xs text-muted">Your coaching center gives you this PIN on paper. Lost it? Ask them for a new one.</p>
          </div>
          <Button className="w-full" disabled={busy || pin.length !== 6}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form onSubmit={staffSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button className="w-full" disabled={busy}>
            {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>
          <div className="flex justify-between text-xs text-muted">
            <button type="button" className="underline" onClick={() => setCreating(!creating)}>
              {creating ? "I already have an account" : "First time? Create an account"}
            </button>
            {!creating && (
              <button type="button" className="underline" onClick={resetPassword}>
                Forgot password
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        <ErrorNote>{error || authError}</ErrorNote>
        {info && <p className="text-sm text-brand">{info}</p>}
      </div>    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight">{APP_NAME}</div>
          <p className="mt-1 text-sm text-muted">Exams, results, fees and parents — in one place.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}

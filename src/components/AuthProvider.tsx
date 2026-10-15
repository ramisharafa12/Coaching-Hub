"use client";

import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth, firebaseConfigured } from "@/lib/firebase";
import type { Role } from "@/lib/types";

export interface Profile {
  role: Role;
  name: string | null;
  email: string | null;
  phone: string | null;
  reason: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** fetch() that sends the Firebase ID token and throws on API errors */
  api: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
    const current = auth.currentUser;
    if (!current) throw new Error("Not signed in");
    const token = await current.getIdToken();
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    return data as T;
  }, []);

  const loadProfile = useCallback(
    async (u: User | null) => {
      setError(null);
      if (!u) {
        setProfile(null);
        return;
      }
      try {
        await u.reload().catch(() => undefined); // pick up a freshly verified email
        await u.getIdToken(true);
        setProfile(await api<Profile>("/api/me"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your account");
        setProfile(null);
      }
    },
    [api]
  );

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadProfile(auth.currentUser);
    setLoading(false);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setProfile(null);
  }, []);

  if (!firebaseConfigured) {
    return (
      <main className="mx-auto max-w-lg p-8 text-sm">
        <h1 className="mb-2 text-xl font-bold">Firebase isn&apos;t configured</h1>
        <p className="text-muted">
          Set the NEXT_PUBLIC_FIREBASE_* variables in <code>.env.local</code> (local) or in Vercel → Project → Settings →
          Environment Variables, then rebuild. See README.md.
        </p>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, refresh, signOut, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function homeForRole(role: Role | undefined): string {
  switch (role) {
    case "admin":
    case "teacher":
      return "/admin";
    case "student":
      return "/student";
    case "guardian":
      return "/guardian";
    default:
      return "/login";
  }
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeForRole, useAuth } from "@/components/AuthProvider";
import { Button, Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import type { Role } from "@/lib/types";

/** Light top-bar layout used by the student and guardian portals. */
export function PortalShell({ role, label, children }: { role: Role; label: string; children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (profile?.role !== role) router.replace(profile ? homeForRole(profile.role) : "/login");
  }, [loading, profile, role, router]);

  if (loading || profile?.role !== role) return <Spinner />;

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/${role}`} className="flex items-baseline gap-2">
            <span className="font-bold">{APP_NAME}</span>
            <span className="text-xs text-muted">{label}</span>
          </Link>
          <Button size="sm" variant="outline" className="border-line text-text" onClick={signOut}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

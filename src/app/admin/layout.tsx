"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeForRole, useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";
import { APP_NAME } from "@/lib/config";
import { cx } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/questions", label: "Question bank" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/fees", label: "Fees" },
  { href: "/admin/notices", label: "Notices" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isStaff = profile?.role === "admin" || profile?.role === "teacher";

  useEffect(() => {
    if (loading) return;
    if (!isStaff) router.replace(profile ? homeForRole(profile.role) : "/login");
  }, [loading, isStaff, profile, router]);

  useEffect(() => setOpen(false), [pathname]);

  if (loading || !isStaff) return <Spinner />;

  // Full-screen pages (print view) skip the sidebar
  if (pathname.endsWith("/print")) return <>{children}</>;

  const nav = profile?.role === "admin" ? [...NAV, { href: "/admin/staff", label: "Staff" }] : NAV;

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <div className="no-print flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <span className="font-bold">{APP_NAME}</span>
        <button onClick={() => setOpen(!open)} className="rounded-md px-2 py-1 text-sm ring-1 ring-white/20">
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <aside
        className={cx(
          "no-print shrink-0 bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:flex-col",
          open ? "block" : "hidden lg:flex"
        )}
      >
        <div className="hidden px-5 pt-6 pb-4 text-lg font-bold lg:block">{APP_NAME}</div>
        <nav className="flex flex-col gap-0.5 px-2 py-2 lg:flex-1">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm",
                  active ? "bg-brand font-semibold text-white" : "text-white/80 hover:bg-ink-soft"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-xs text-white/70">
          <div className="truncate font-semibold text-white">{profile?.name}</div>
          <div className="capitalize">{profile?.role}</div>
          <button onClick={signOut} className="mt-2 underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

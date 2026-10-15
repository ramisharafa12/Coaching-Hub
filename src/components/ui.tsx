"use client";

import { useEffect } from "react";
import { cx } from "@/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
        variant === "outline" && "border border-brand bg-white text-brand hover:bg-brand-soft/50",
        variant === "ghost" && "text-brand hover:bg-brand-soft/50",
        variant === "danger" && "border border-danger/40 bg-white text-danger hover:bg-danger-soft",
        className
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("rounded-2xl bg-white p-5", className)}>{children}</div>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[0.95rem] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "brand" | "danger" }) {
  return (
    <Card className="py-4">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-bold tracking-tight",
          tone === "brand" && "text-brand",
          tone === "danger" && "text-danger"
        )}
      >
        {value}
      </div>
    </Card>
  );
}

type BadgeTone = "green" | "yellow" | "gray" | "red";
export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold",
        tone === "green" && "bg-brand-soft text-brand-dark",
        tone === "yellow" && "bg-warn-soft text-warn",
        tone === "gray" && "bg-[#e8ecea] text-text",
        tone === "red" && "bg-danger-soft text-danger"
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        className={cx("w-full rounded-2xl bg-white p-6 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-mint" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{children}</div>;
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
        active ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-text hover:border-brand/50"
      )}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  return (
    <div className="mb-3 flex gap-5 text-sm">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx("border-b-2 pb-1.5", value === t.value ? "border-brand font-semibold" : "border-transparent text-muted")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

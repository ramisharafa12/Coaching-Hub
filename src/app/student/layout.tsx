import { PortalShell } from "@/components/PortalShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell role="student" label="Student portal">
      {children}
    </PortalShell>
  );
}

import { PortalShell } from "@/components/PortalShell";

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell role="guardian" label="Guardian portal">
      {children}
    </PortalShell>
  );
}

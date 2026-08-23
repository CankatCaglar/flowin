import { RouteGuard } from "@/components/auth/RouteGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard requireAuth requireBrand>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}

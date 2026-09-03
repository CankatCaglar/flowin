import { RouteGuard } from "@/components/auth/RouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { redirect } from "@/i18n/navigation";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await getAdminSessionEmail())) {
    redirect({ href: "/login", locale });
  }
  return (
    <RouteGuard requireAuth requireBrand>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}

import { getAdminSessionEmail } from "@/lib/admin-session";
import { redirect } from "@/i18n/navigation";

export default async function BrandsLayout({
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
  return children;
}

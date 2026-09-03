import { LoginForm } from "@/components/auth/LoginForm";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { redirect } from "@/i18n/navigation";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const reauthLinkedIn = query.linkedin === "1";
  if (!reauthLinkedIn && (await getAdminSessionEmail())) {
    redirect({ href: "/brands", locale });
  }
  return <LoginForm reauthLinkedIn={reauthLinkedIn} />;
}

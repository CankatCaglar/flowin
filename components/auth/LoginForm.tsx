"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FlowinLogo } from "@/components/brand/FlowinLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
import { useRouter } from "@/i18n/navigation";
import { fetchBrands } from "@/lib/brands-api";

export function LoginForm({ reauthLinkedIn = false }: { reauthLinkedIn?: boolean }) {
  const t = useTranslations("login");
  const authT = useTranslations("auth");
  const locale = useLocale();
  const { signIn, signOut } = useAuth();
  const { seedBrands } = useBrand();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reauthLinkedIn) return;
    void signOut();
  }, [reauthLinkedIn, signOut]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError(authT("required"));
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      if (reauthLinkedIn) {
        // Top-level navigation: OAuth start sets cookies and leaves the app.
        window.location.replace(`/api/linkedin/start?locale=${locale}`);
        return;
      }
      try {
        seedBrands(await fetchBrands());
      } catch {
        // BrandProvider refresh will retry on the brands page.
      }
      router.replace("/brands");
    } catch {
      setError(authT("invalidCredentials"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-midnight px-4 py-12">
      <div className="animate-rise flex w-full max-w-[420px] flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-3.5">
          <FlowinLogo height={40} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-jam/60 px-3 py-1 text-[11px] font-medium tracking-wide text-white/70">
            <Shield className="h-3.5 w-3.5 text-barney" />
            {t("badge")}
          </span>
        </div>

        <form onSubmit={onSubmit} className="admin-card w-full rounded-2xl px-8 py-8">
          <div className="space-y-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-white">{t("title")}</h1>
            <p className="max-w-sm text-[13px] leading-6 text-white/50">{t("subtitle")}</p>
          </div>

          <div className="mt-7 space-y-4">
            <Input
              id="email"
              label={t("email")}
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              className="h-11 bg-midnight/90"
            />
            <Input
              id="password"
              label={t("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              className="h-11 bg-midnight/90"
              rightIcon={
                <button
                  type="button"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-white/45 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>

          {error ? <p className="mt-4 text-[13px] text-rose-300">{error}</p> : null}

          <Button type="submit" className="mt-7 h-11 w-full text-[14px]" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>

        <p className="mt-6 flex items-center gap-2 text-[11px] text-white/35">
          <Lock className="h-3.5 w-3.5" />
          {t("footer")}
        </p>
      </div>
    </div>
  );
}

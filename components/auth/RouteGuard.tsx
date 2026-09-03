"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/contexts/BrandContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { readSelectedBrandId } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function RouteGuard({
  children,
  requireAuth = false,
  requireBrand = false,
  guestOnly = false,
  tone = "light",
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireBrand?: boolean;
  guestOnly?: boolean;
  tone?: "light" | "dark";
}) {
  const t = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const { selectedBrand, loading: brandLoading } = useBrand();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;
    if (requireBrand && brandLoading) return;

    const storedBrandId = selectedBrand?.id ?? readSelectedBrandId();

    const reauthLinkedIn =
      pathname === "/login" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("linkedin") === "1";

    if (guestOnly && user && !reauthLinkedIn) {
      router.replace("/brands");
      return;
    }

    if (requireAuth && !user) {
      router.replace("/login");
      return;
    }

    if (requireBrand && user && !selectedBrand && !storedBrandId) {
      router.replace("/brands");
    }
  }, [
    authLoading,
    brandLoading,
    guestOnly,
    requireAuth,
    requireBrand,
    router,
    selectedBrand,
    user,
    pathname,
  ]);

  if (authLoading || (requireBrand && brandLoading && !selectedBrand)) {
    return (
      <div
        className={cn(
          "flex h-full min-h-full items-center justify-center text-sm",
          tone === "dark" ? "bg-midnight text-white/50" : "bg-canvas text-muted",
        )}
      >
        {t("loading")}
      </div>
    );
  }

  return children;
}

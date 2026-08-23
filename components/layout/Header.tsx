"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { UserMenu } from "@/components/layout/UserMenu";
import { useBrand } from "@/contexts/BrandContext";
import { usePathname } from "@/i18n/navigation";
import { brandInitial } from "@/lib/utils";

const titles: Record<string, "overview" | "campaigns" | "leads" | "messages" | "reports" | "settings"> = {
  "/dashboard": "overview",
  "/campaigns": "campaigns",
  "/leads": "leads",
  "/messages": "messages",
  "/reports": "reports",
  "/settings": "settings",
};

export function Header({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu?: () => void;
}) {
  const t = useTranslations("nav");
  const { selectedBrand } = useBrand();
  const pathname = usePathname();
  const pageKey = titles[pathname] ?? "overview";
  const showDate = pathname === "/dashboard" || pathname === "/reports";

  if (!selectedBrand) return null;

  return (
    <header className="flex h-app-header shrink-0 items-center justify-between gap-3 border-b border-purple-jam/10 bg-white px-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={t("openMenu")}
          className="rounded-lg p-2 text-ink hover:bg-canvas lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: selectedBrand.avatarColor }}
        >
          {brandInitial(selectedBrand.name)}
        </span>
        <p className="truncate text-sm font-medium text-ink">
          {selectedBrand.name}
          <span className="text-muted"> / {t(pageKey)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {showDate ? <DateRangePicker /> : null}
        <UserMenu variant="light" />
      </div>
    </header>
  );
}

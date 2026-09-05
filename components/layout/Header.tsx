"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { UserMenu } from "@/components/layout/UserMenu";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { usePathname } from "@/i18n/navigation";
import { BrandAvatar } from "@/components/brands/BrandAvatar";

const titles: Record<string, "overview" | "campaigns" | "leads" | "messages" | "settings"> = {
  "/dashboard": "overview",
  "/campaigns": "campaigns",
  "/leads": "leads",
  "/messages": "messages",
  "/settings": "settings",
};

function campaignBreadcrumb(pathname: string) {
  if (!pathname.startsWith("/campaigns")) return null;
  const parts = pathname.split("/").filter(Boolean);
  const segment = parts[1];
  if (!segment) return { kind: "list" as const };
  if (segment === "new") return { kind: "new" as const };
  return { kind: "detail" as const, id: segment };
}

export function Header({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu?: () => void;
}) {
  const t = useTranslations("nav");
  const campaignsT = useTranslations("campaigns");
  const { selectedBrand } = useBrand();
  const pathname = usePathname();
  const pageKey = titles[pathname] ?? (pathname.startsWith("/campaigns") ? "campaigns" : "overview");
  const showDate = pathname === "/dashboard";
  const crumb = campaignBreadcrumb(pathname);
  const { campaigns } = useBrandData(crumb?.kind === "detail" ? selectedBrand?.id ?? null : null);
  const campaignName =
    crumb?.kind === "detail"
      ? campaigns.find((campaign) => campaign.id === crumb.id)?.name
      : null;

  if (!selectedBrand) return null;

  const mobileTitle =
    crumb?.kind === "new"
      ? campaignsT("create.title")
      : campaignName ?? t(pageKey);

  return (
    <header className="flex h-app-header shrink-0 items-center justify-between gap-2 border-b border-purple-jam/10 bg-white px-3 sm:gap-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={t("openMenu")}
          className="-ml-1 rounded-lg p-1.5 text-ink hover:bg-canvas lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden shrink-0 sm:flex">
          <BrandAvatar brand={selectedBrand} size="sm" />
        </div>
        <p className="min-w-0 truncate font-display text-sm font-semibold text-ink lg:hidden">
          {mobileTitle}
        </p>
        <p className="hidden min-w-0 truncate font-display text-sm font-medium text-ink lg:block">
          {selectedBrand.name}
          <span className="text-muted"> / {t(pageKey)}</span>
          {crumb?.kind === "new" ? (
            <span className="text-muted"> / {campaignsT("create.title")}</span>
          ) : null}
          {campaignName ? <span className="text-muted"> / {campaignName}</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {showDate ? <DateRangePicker /> : null}
        <UserMenu variant="light" />
      </div>
    </header>
  );
}

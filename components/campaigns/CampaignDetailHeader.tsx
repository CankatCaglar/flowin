"use client";

import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/Badge";
import { Link, usePathname } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

export function CampaignDetailHeader({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.tabs");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const pathname = usePathname();
  const base = `/campaigns/${campaign.id}`;
  const tabs = [
    { href: base, key: "overview" as const, exact: true },
    { href: `${base}/leads`, key: "leads" as const, exact: false },
    { href: `${base}/flow`, key: "flow" as const, exact: false },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">{campaign.name}</h1>
        <StatusBadge status={campaign.status} label={statusT(campaign.status)} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatDate(campaign.startDate, locale)}
        {" – "}
        {formatDate(campaign.endDate, locale)}
      </p>
      <nav className="mt-5 flex gap-6 border-b border-purple-jam/10">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "font-display -mb-px border-b-2 pb-2.5 text-sm font-medium",
                active
                  ? "border-barney text-barney"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Link, usePathname } from "@/i18n/navigation";
import { isCampaignRunning } from "@/lib/campaign-status";
import { updateCampaign } from "@/lib/outreach-api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types";

export function CampaignDetailHeader({
  campaign,
  onChanged,
}: {
  campaign: Campaign;
  onChanged?: () => void;
}) {
  const t = useTranslations("campaigns.tabs");
  const list = useTranslations("campaigns");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const pathname = usePathname();
  const [saving, setSaving] = useState(false);
  const base = `/campaigns/${campaign.id}`;
  const tabs = [
    { href: base, key: "overview" as const, exact: true },
    { href: `${base}/leads`, key: "leads" as const, exact: false },
    { href: `${base}/flow`, key: "flow" as const, exact: false },
  ];

  const setStatus = async (status: CampaignStatus) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateCampaign(campaign.id, { status });
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <BackLink href="/campaigns" label={list("backToList")} className="mb-3" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">{campaign.name}</h1>
        <StatusBadge status={campaign.status} label={statusT(campaign.status)} />
        <div className="ml-auto flex flex-wrap gap-2">
          {isCampaignRunning(campaign.status) ? (
            <Button variant="brand" disabled={saving} onClick={() => void setStatus("paused")}>
              {list("pauseCampaign")}
            </Button>
          ) : null}
          {campaign.status === "paused" || campaign.status === "draft" ? (
            <Button disabled={saving} onClick={() => void setStatus("active")}>
              {list("resumeCampaign")}
            </Button>
          ) : null}
          {campaign.status !== "completed" ? (
            <Button variant="brand" disabled={saving} onClick={() => void setStatus("completed")}>
              {list("completeCampaign")}
            </Button>
          ) : null}
        </div>
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

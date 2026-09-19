"use client";

import { AlertTriangle, ChevronRight, Clock, TriangleAlert, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

function leadsPath(query: string, campaignId?: string) {
  const campaign = campaignId ? `&campaign=${encodeURIComponent(campaignId)}` : "";
  return `/leads?${query}${campaign}`;
}

function campaignAttentionPath(campaigns: Campaign[], suffix = "", attention: "depleted" | "low") {
  if (campaigns.length === 1) return `/campaigns/${campaigns[0].id}${suffix}`;
  return `/campaigns?attention=${attention}`;
}

export function AttentionList({
  failedCount,
  failedCampaignId,
  depletedCampaigns = [],
  lowResponseCampaigns = [],
  followUpCount,
  followUpCampaignId,
  showFailed = true,
  showExpiring = true,
  showLowResponse = true,
}: {
  failedCount: number;
  failedCampaignId?: string;
  depletedCampaigns?: Campaign[];
  lowResponseCampaigns?: Campaign[];
  followUpCount: number;
  followUpCampaignId?: string;
  showFailed?: boolean;
  showExpiring?: boolean;
  showLowResponse?: boolean;
}) {
  const t = useTranslations("dashboard.attention");

  const items = [
    {
      id: "failed",
      href: failedCount > 0 ? leadsPath("stage=failed", failedCampaignId) : null,
      label: t("failed"),
      hint: t("failedHint", { count: failedCount }),
      icon: TriangleAlert,
      iconClass: "text-orange-600",
      visible: showFailed,
    },
    {
      id: "expiring",
      href:
        depletedCampaigns.length > 0
          ? campaignAttentionPath(depletedCampaigns, "/leads", "depleted")
          : null,
      label: t("expiring"),
      hint: t("expiringHint", { count: depletedCampaigns.length }),
      icon: Clock,
      iconClass: "text-rose-600",
      visible: showExpiring,
    },
    {
      id: "lowResponse",
      href:
        lowResponseCampaigns.length > 0
          ? campaignAttentionPath(lowResponseCampaigns, "", "low")
          : null,
      label: t("lowResponse"),
      hint: t("lowResponseHint", { count: lowResponseCampaigns.length }),
      icon: AlertTriangle,
      iconClass: "text-barney",
      visible: showLowResponse,
    },
    {
      id: "followUp",
      href:
        followUpCount > 0
          ? `/messages?awaiting=ours${followUpCampaignId ? `&campaign=${encodeURIComponent(followUpCampaignId)}` : ""}`
          : null,
      label: t("followUp"),
      hint: t("followUpHint", { count: followUpCount }),
      icon: UserRound,
      iconClass: "text-sky-700",
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <article className="surface-card h-full rounded-2xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink sm:text-base">{t("title")}</h2>
      <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          const className = cn(
            "flex items-center gap-2.5 rounded-xl border border-purple-jam/10 bg-white px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3",
            item.href ? "transition-colors hover:border-barney/25" : "cursor-default opacity-70",
          );
          const body = (
            <>
              <Icon className={`h-4 w-4 shrink-0 ${item.iconClass}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>
              </span>
              {item.href ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" /> : null}
            </>
          );
          if (!item.href) {
            return (
              <div key={item.id} className={className}>
                {body}
              </div>
            );
          }
          return (
            <Link key={item.id} href={item.href} className={className}>
              {body}
            </Link>
          );
        })}
      </div>
    </article>
  );
}

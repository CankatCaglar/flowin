"use client";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { formatNumber, formatPercent, successRate } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types";

const VISIBLE_ROWS = 2;

export function ActiveCampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
  const t = useTranslations("dashboard.table");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const rows = campaigns
    .filter((campaign) => campaign.status !== "completed")
    .slice(0, VISIBLE_ROWS);

  return (
    <article className="surface-card flex h-full flex-col rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{t("title")}</h2>
      <div className="mt-4 flex-1 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-canvas/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="rounded-l-lg px-3 py-2.5 font-medium">{t("name")}</th>
              <th className="px-3 py-2.5 font-medium">{t("sent")}</th>
              <th className="px-3 py-2.5 font-medium">{t("replied")}</th>
              <th className="px-3 py-2.5 font-medium">{t("success")}</th>
              <th className="rounded-r-lg px-3 py-2.5 font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((campaign) => (
              <tr key={campaign.id} className="border-t border-purple-jam/8">
                <td className="px-3 py-3 font-medium text-ink">
                  <Link href={`/campaigns/${campaign.id}`} className="hover:text-barney">
                    {campaign.name}
                  </Link>
                </td>
                <td className="px-3 py-3 text-muted">
                  {formatNumber(campaign.sentCount, locale)}
                </td>
                <td className="px-3 py-3 text-muted">
                  {formatNumber(campaign.repliedCount, locale)}
                </td>
                <td className="px-3 py-3 text-muted">
                  {formatPercent(
                    successRate(campaign.sentCount, campaign.repliedCount),
                    locale,
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge
                    status={campaign.status}
                    label={statusT(campaign.status as CampaignStatus)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        href="/campaigns"
        className="mt-4 inline-flex w-full items-center justify-center gap-1 text-sm font-medium text-barney hover:opacity-80"
      >
        {t("viewAll")}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

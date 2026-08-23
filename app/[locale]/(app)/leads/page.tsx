"use client";

import { Suspense, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import { Link } from "@/i18n/navigation";
import { isUnresponsiveLead } from "@/lib/metrics";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const common = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted">{common("loading")}</p>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const t = useTranslations("leads");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const { selectedBrand } = useBrand();
  const { now } = useDateRange();
  const { campaigns, leads, loading } = useBrandData(selectedBrand?.id ?? null);

  const campaignNames = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.name])),
    [campaigns],
  );

  const rows = useMemo(() => {
    if (filter === "unresponsive") {
      return leads.filter((lead) => isUnresponsiveLead(lead, now));
    }
    if (filter === "in_progress") {
      return leads.filter((lead) => lead.status === "in_progress");
    }
    return leads;
  }, [filter, leads, now]);

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <Link
              href="/leads"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                !filter
                  ? "bg-barney text-white"
                  : "bg-white text-muted",
              )}
            >
              {t("filterAll")}
            </Link>
            <Link
              href="/leads?filter=unresponsive"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                filter === "unresponsive"
                  ? "bg-barney text-white"
                  : "bg-white text-muted",
              )}
            >
              {t("filterUnresponsive")}
            </Link>
            <Link
              href="/leads?filter=in_progress"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                filter === "in_progress"
                  ? "bg-barney text-white"
                  : "bg-white text-muted",
              )}
            >
              {t("filterFollowUp")}
            </Link>
          </div>
        }
      />
      <div className="surface-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{t("name")}</th>
              <th className="px-5 py-3 font-medium">{t("campaign")}</th>
              <th className="px-5 py-3 font-medium">{t("linkedin")}</th>
              <th className="px-5 py-3 font-medium">{t("status")}</th>
              <th className="px-5 py-3 font-medium">{t("lastMessage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id} className="border-t border-purple-jam/8">
                <td className="px-5 py-3 font-medium text-ink">{lead.fullName}</td>
                <td className="px-5 py-3 text-muted">
                  {campaignNames.get(lead.campaignId) ?? lead.campaignId}
                </td>
                <td className="px-5 py-3">
                  <a
                    href={lead.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-barney hover:opacity-80"
                  >
                    {t("linkedin")}
                  </a>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={lead.status} label={statusT(lead.status)} />
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatDate(lead.lastMessageSentAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{common("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}

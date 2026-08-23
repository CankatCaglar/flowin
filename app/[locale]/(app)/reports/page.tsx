"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import { kpiMetrics } from "@/lib/metrics";
import { formatNumber, formatPercent, successRate } from "@/lib/utils";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const campaignsT = useTranslations("campaigns");
  const statusT = useTranslations("status");
  const common = useTranslations("common");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const { range } = useDateRange();
  const { campaigns, stats, loading } = useBrandData(selectedBrand?.id ?? null);
  const kpis = kpiMetrics(campaigns, stats, range);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="surface-card rounded-2xl p-5">
          <p className="text-sm text-muted">{t("sent")}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatNumber(kpis.sentCount, locale)}
          </p>
        </article>
        <article className="surface-card rounded-2xl p-5">
          <p className="text-sm text-muted">{t("replied")}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatNumber(kpis.repliedCount, locale)}
          </p>
        </article>
        <article className="surface-card rounded-2xl p-5">
          <p className="text-sm text-muted">{t("success")}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatPercent(kpis.successRate, locale)}
          </p>
        </article>
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">{t("campaigns")}</h2>
      <div className="surface-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{campaignsT("name")}</th>
              <th className="px-5 py-3 font-medium">{campaignsT("sent")}</th>
              <th className="px-5 py-3 font-medium">{campaignsT("replied")}</th>
              <th className="px-5 py-3 font-medium">{campaignsT("success")}</th>
              <th className="px-5 py-3 font-medium">{campaignsT("status")}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-t border-purple-jam/8">
                <td className="px-5 py-3 font-medium text-ink">{campaign.name}</td>
                <td className="px-5 py-3 text-muted">
                  {formatNumber(campaign.sentCount, locale)}
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatNumber(campaign.repliedCount, locale)}
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatPercent(
                    successRate(campaign.sentCount, campaign.repliedCount),
                    locale,
                  )}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge
                    status={campaign.status}
                    label={statusT(campaign.status)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && campaigns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{common("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}

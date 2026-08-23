"use client";

import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { formatDate, formatNumber, formatPercent, successRate } from "@/lib/utils";

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const { campaigns, loading } = useBrandData(selectedBrand?.id ?? null);

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="surface-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{t("name")}</th>
              <th className="px-5 py-3 font-medium">{t("sent")}</th>
              <th className="px-5 py-3 font-medium">{t("replied")}</th>
              <th className="px-5 py-3 font-medium">{t("success")}</th>
              <th className="px-5 py-3 font-medium">{t("status")}</th>
              <th className="px-5 py-3 font-medium">{t("dates")}</th>
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
                <td className="px-5 py-3 text-muted">
                  {formatDate(campaign.startDate, locale)} –{" "}
                  {formatDate(campaign.endDate, locale)}
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

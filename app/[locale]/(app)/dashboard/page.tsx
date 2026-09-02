"use client";

import { useTranslations } from "next-intl";
import { ActiveCampaignsTable } from "@/components/dashboard/ActiveCampaignsTable";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { FeaturedInsights } from "@/components/dashboard/FeaturedInsights";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import {
  averageReplyDays,
  bestCampaign,
  chartSeries,
  expiringCampaigns,
  kpiMetrics,
  lowResponseCampaigns,
  mostRepliedCampaign,
  failedLeads,
} from "@/lib/metrics";

export default function DashboardPage() {
  const t = useTranslations("common");
  const { selectedBrand } = useBrand();
  const { range, now } = useDateRange();
  const { campaigns, leads, stats, loading } = useBrandData(selectedBrand?.id ?? null);

  if (loading) {
    return <p className="text-sm text-muted">{t("loading")}</p>;
  }

  const kpis = kpiMetrics(campaigns, stats, range, leads);
  const series = chartSeries(stats, range);

  return (
    <div className="space-y-6">
      <KpiCards {...kpis} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PerformanceChart data={series} />
        </div>
        <AttentionList
          failedCount={failedLeads(leads).length}
          expiringCount={expiringCampaigns(campaigns, now).length}
          lowResponseCount={lowResponseCampaigns(campaigns).length}
          followUpCount={leads.filter((lead) => lead.status === "queued").length}
        />
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActiveCampaignsTable campaigns={campaigns} />
        </div>
        <FeaturedInsights
          best={bestCampaign(campaigns)}
          mostReplied={mostRepliedCampaign(campaigns)}
          averageReplyDays={averageReplyDays(leads)}
        />
      </div>
    </div>
  );
}

"use client";

import { ActiveCampaignsTable } from "@/components/dashboard/ActiveCampaignsTable";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { FeaturedInsights } from "@/components/dashboard/FeaturedInsights";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
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
import { leadNeedsOurReply } from "@/lib/chat-thread";

export default function DashboardPage() {
  const { selectedBrand } = useBrand();
  const { range } = useDateRange();
  const { campaigns, leads, stats, messages, loading } = useBrandData(selectedBrand?.id ?? null);

  if (loading && campaigns.length === 0) {
    return <PageSkeleton />;
  }

  const kpis = kpiMetrics(campaigns, stats, range, leads, messages);
  const series = chartSeries(stats, range, leads, messages);
  const failed = failedLeads(leads);
  const depleted = expiringCampaigns(campaigns, leads);
  const weak = lowResponseCampaigns(campaigns, leads, messages);
  const waiting = leads.filter((lead) => leadNeedsOurReply(lead, messages));
  const singleCampaignId = (rows: { campaignId: string }[]) => {
    const ids = [...new Set(rows.map((row) => row.campaignId))];
    return ids.length === 1 ? ids[0] : undefined;
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      <KpiCards {...kpis} />
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <PerformanceChart data={series} />
        </div>
        <AttentionList
          failedCount={failed.length}
          failedCampaignId={singleCampaignId(failed)}
          depletedCampaigns={depleted}
          lowResponseCampaigns={weak}
          followUpCount={waiting.length}
          followUpCampaignId={singleCampaignId(waiting)}
          showFailed={selectedBrand?.alerts?.sendFailed !== false}
          showExpiring={selectedBrand?.alerts?.lowLeads !== false}
          showLowResponse={selectedBrand?.alerts?.lowLeads !== false}
        />
      </div>
      <div className="grid min-w-0 items-stretch gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <ActiveCampaignsTable campaigns={campaigns} leads={leads} messages={messages} />
        </div>
        <FeaturedInsights
          best={bestCampaign(campaigns, leads, messages)}
          mostReplied={mostRepliedCampaign(campaigns, messages, leads)}
          averageReplyDays={averageReplyDays(leads, messages)}
          leads={leads}
          messages={messages}
        />
      </div>
    </div>
  );
}

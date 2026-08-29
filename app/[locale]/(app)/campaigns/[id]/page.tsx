"use client";

import { use } from "react";
import { CampaignFlowSummary } from "@/components/campaigns/CampaignFlowSummary";
import { CampaignHighlights } from "@/components/campaigns/CampaignHighlights";
import { CampaignKpiCards } from "@/components/campaigns/CampaignKpiCards";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import { bestStatDay, campaignReplyDays, scaleStatsToCampaign } from "@/lib/campaign-metrics";
import { chartSeries } from "@/lib/metrics";
import { successRate } from "@/lib/utils";

export default function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedBrand } = useBrand();
  const { range } = useDateRange();
  const { campaigns, leads, stats } = useBrandData(selectedBrand?.id ?? null);
  const campaign = campaigns.find((item) => item.id === id);
  if (!campaign) return null;

  const scaled = scaleStatsToCampaign(stats, campaign, campaigns);
  const series = chartSeries(scaled, range);
  const best = bestStatDay(scaled);
  const messageSteps = campaign.flow.filter((step) => step.kind === "message");
  const topStep = messageSteps[1] ?? messageSteps[0] ?? campaign.flow[0];
  const topStepRate =
    campaign.sentCount > 0
      ? Math.min(100, successRate(campaign.sentCount, campaign.repliedCount) * 1.4)
      : 0;

  return (
    <div className="space-y-6">
      <CampaignKpiCards
        leadGoal={campaign.leadGoal}
        delivered={campaign.sentCount}
        replied={campaign.repliedCount}
        success={successRate(campaign.sentCount, campaign.repliedCount)}
      />
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <div className="min-h-0 xl:col-span-2">
          <PerformanceChart data={series} />
        </div>
        <CampaignFlowSummary campaign={campaign} />
      </div>
      <CampaignHighlights
        bestDayKey={best?.date}
        bestDayRate={best ? successRate(best.sentCount, best.repliedCount) : 0}
        topStep={topStep}
        topStepRate={topStepRate}
        averageReplyDays={campaignReplyDays(leads, campaign.id)}
      />
    </div>
  );
}

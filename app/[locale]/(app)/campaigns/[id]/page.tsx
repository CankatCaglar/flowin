"use client";

import { use } from "react";
import { CampaignFlowSummary } from "@/components/campaigns/CampaignFlowSummary";
import { CampaignHighlights } from "@/components/campaigns/CampaignHighlights";
import { CampaignKpiCards } from "@/components/campaigns/CampaignKpiCards";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";
import { bestStatDay, campaignReplyDays, topRepliedStep } from "@/lib/campaign-metrics";
import { chartSeries, countContactedLeads, countFlowMessages } from "@/lib/metrics";
import { successRate } from "@/lib/utils";

export default function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedBrand } = useBrand();
  const { range } = useDateRange();
  const { campaigns, leads, stats } = useBrandData(selectedBrand?.id ?? null, id);
  const campaign = campaigns.find((item) => item.id === id);
  if (!campaign) return null;

  const campaignLeads = leads.filter((lead) => lead.campaignId === campaign.id);
  const contacted = countContactedLeads(campaignLeads, campaign.id);
  const flowSent = countFlowMessages(campaignLeads, campaign.id);
  const series = chartSeries(stats, range, campaignLeads);
  const best = bestStatDay(stats);
  const top = topRepliedStep(campaign, leads);
  const leadCount = campaignLeads.length;

  return (
    <div className="space-y-6">
      <CampaignKpiCards
        leadGoal={leadCount > 0 ? leadCount : campaign.leadGoal}
        delivered={contacted}
        replied={campaign.repliedCount}
        success={successRate(flowSent, campaign.repliedCount)}
        hasSends={flowSent > 0}
      />
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <div className="min-h-0 xl:col-span-2">
          <PerformanceChart data={series} />
        </div>
        <CampaignFlowSummary campaign={campaign} />
      </div>
      <CampaignHighlights
        bestDayKey={best?.date}
        bestDayRate={best ? successRate(Number(best.messages ?? 0) + Number(best.inmails ?? 0) || best.sentCount, best.repliedCount) : undefined}
        topStep={top?.step}
        topStepRate={top?.rate}
        averageReplyDays={campaignReplyDays(leads, campaign.id)}
      />
    </div>
  );
}

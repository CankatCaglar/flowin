import { averageReplyDays } from "@/lib/metrics";
import { successRate } from "@/lib/utils";
import type { Campaign, DailyStat, Lead } from "@/types";

export function scaleStatsToCampaign(
  stats: DailyStat[],
  campaign: Campaign,
  allCampaigns: Campaign[],
): DailyStat[] {
  const brandSent = allCampaigns.reduce((sum, item) => sum + item.sentCount, 0);
  const ratio = brandSent > 0 ? campaign.sentCount / brandSent : 0;
  return stats.map((stat) => ({
    date: stat.date,
    sentCount: Math.round(stat.sentCount * ratio),
    repliedCount: Math.round(stat.repliedCount * ratio),
  }));
}

export function bestStatDay(stats: DailyStat[]) {
  return [...stats]
    .filter((stat) => stat.sentCount > 0)
    .sort(
      (a, b) =>
        successRate(b.sentCount, b.repliedCount) - successRate(a.sentCount, a.repliedCount),
    )[0];
}

export function campaignReplyDays(leads: Lead[], campaignId: string) {
  return averageReplyDays(leads.filter((lead) => lead.campaignId === campaignId));
}

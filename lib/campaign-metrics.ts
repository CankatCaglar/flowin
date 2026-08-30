import { averageReplyDays } from "@/lib/metrics";
import { successRate } from "@/lib/utils";
import type { DailyStat, Lead } from "@/types";

export function scaleStatsToCampaign(stats: DailyStat[]): DailyStat[] {
  return stats;
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

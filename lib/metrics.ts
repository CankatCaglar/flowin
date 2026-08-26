import { eachDateKey, previousRange } from "@/lib/dates";
import { successRate, trendPercent } from "@/lib/utils";
import type { Campaign, DailyStat, DateRange, Lead } from "@/types";

const UNRESPONSIVE_DAYS = 7;
const EXPIRING_DAYS = 3;
const LOW_RESPONSE_MIN_SENT = 50;
const LOW_RESPONSE_MAX_RATE = 10;
const BEST_CAMPAIGN_MIN_SENT = 50;

export function sumStats(stats: DailyStat[], range: DateRange) {
  const keys = new Set(eachDateKey(range));
  return stats.reduce(
    (acc, stat) => {
      if (!keys.has(stat.date)) return acc;
      acc.sentCount += stat.sentCount;
      acc.repliedCount += stat.repliedCount;
      return acc;
    },
    { sentCount: 0, repliedCount: 0 },
  );
}

export type ChartGrain = "day" | "week" | "month";

export interface ChartPoint {
  date: string;
  sentCount: number;
  repliedCount: number;
  successRate: number;
}

export function chartSeries(stats: DailyStat[], range: DateRange): ChartPoint[] {
  const byDate = new Map(stats.map((stat) => [stat.date, stat]));
  return eachDateKey(range).map((date) => {
    const stat = byDate.get(date);
    const sentCount = stat?.sentCount ?? 0;
    const repliedCount = stat?.repliedCount ?? 0;
    return {
      date,
      sentCount,
      repliedCount,
      successRate: successRate(sentCount, repliedCount),
    };
  });
}

function mergePoints(slice: ChartPoint[]): ChartPoint {
  const sentCount = slice.reduce((sum, point) => sum + point.sentCount, 0);
  const repliedCount = slice.reduce((sum, point) => sum + point.repliedCount, 0);
  return {
    date: slice[slice.length - 1]?.date ?? slice[0]?.date ?? "",
    sentCount,
    repliedCount,
    successRate: successRate(sentCount, repliedCount),
  };
}

export function bucketChartSeries(points: ChartPoint[]): {
  points: ChartPoint[];
  grain: ChartGrain;
} {
  if (points.length <= 31) {
    return { points, grain: "day" };
  }

  if (points.length <= 90) {
    const weekly: ChartPoint[] = [];
    for (let index = 0; index < points.length; index += 7) {
      weekly.push(mergePoints(points.slice(index, index + 7)));
    }
    return { points: weekly, grain: "week" };
  }

  const groups = new Map<string, ChartPoint[]>();
  points.forEach((point) => {
    const key = point.date.slice(0, 7);
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  });

  return {
    points: [...groups.values()].map(mergePoints),
    grain: "month",
  };
}

export function kpiMetrics(campaigns: Campaign[], stats: DailyStat[], range: DateRange) {
  const current = sumStats(stats, range);
  const previous = sumStats(stats, previousRange(range));
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active" || campaign.status === "expiring",
  ).length;

  return {
    activeCampaigns,
    sentCount: current.sentCount,
    repliedCount: current.repliedCount,
    successRate: successRate(current.sentCount, current.repliedCount),
    sentTrend: trendPercent(current.sentCount, previous.sentCount),
    repliedTrend: trendPercent(current.repliedCount, previous.repliedCount),
  };
}

export function isUnresponsiveLead(lead: Lead, now: Date) {
  if (lead.status !== "waiting_reply") return false;
  const elapsed = now.getTime() - lead.lastMessageSentAt.getTime();
  return elapsed >= UNRESPONSIVE_DAYS * 86_400_000;
}

export function unresponsiveLeads(leads: Lead[], now: Date) {
  return leads.filter((lead) => isUnresponsiveLead(lead, now));
}

export function expiringCampaigns(campaigns: Campaign[], now: Date) {
  const limit = EXPIRING_DAYS * 86_400_000;
  return campaigns.filter((campaign) => {
    if (campaign.status === "draft" || campaign.status === "completed") return false;
    const remaining = campaign.endDate.getTime() - now.getTime();
    return remaining >= 0 && remaining <= limit;
  });
}

export function lowResponseCampaigns(campaigns: Campaign[]) {
  return campaigns.filter((campaign) => {
    if (campaign.sentCount < LOW_RESPONSE_MIN_SENT) return false;
    return successRate(campaign.sentCount, campaign.repliedCount) < LOW_RESPONSE_MAX_RATE;
  });
}

export function bestCampaign(campaigns: Campaign[]) {
  return campaigns
    .filter((campaign) => campaign.sentCount >= BEST_CAMPAIGN_MIN_SENT)
    .sort(
      (a, b) =>
        successRate(b.sentCount, b.repliedCount) - successRate(a.sentCount, a.repliedCount),
    )[0];
}

export function mostRepliedCampaign(campaigns: Campaign[]) {
  return [...campaigns].sort((a, b) => b.repliedCount - a.repliedCount)[0];
}

export function averageReplyDays(leads: Lead[]) {
  const samples = leads.filter((lead) => lead.firstReplyReceivedAt);
  if (samples.length === 0) return 0;
  const total = samples.reduce((sum, lead) => {
    const firstReply = lead.firstReplyReceivedAt;
    if (!firstReply) return sum;
    return sum + (firstReply.getTime() - lead.lastMessageSentAt.getTime());
  }, 0);
  return total / samples.length / 86_400_000;
}

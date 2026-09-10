import { messageIsLeadReply } from "@/lib/chat-thread";
import { isCampaignRunning } from "@/lib/campaign-status";
import { eachDateKey, previousRange, toDateKey } from "@/lib/dates";
import {
  FLOW_MESSAGE_EVENT_KINDS,
  leadWasContacted,
  SEND_EVENT_KINDS,
} from "@/lib/leads";
import { successRate, trendPercent } from "@/lib/utils";
import type { Campaign, DailyStat, DateRange, Lead, LeadEvent, OutreachMessage } from "@/types";

const UNRESPONSIVE_DAYS = 7;
const EXPIRING_DAYS = 3;
const LOW_RESPONSE_MIN_SENT = 50;
const LOW_RESPONSE_MAX_RATE = 10;

export function repliedLeadIds(
  messages: OutreachMessage[],
  campaignId?: string,
  range?: DateRange,
  dateKey?: string,
) {
  const keys = range ? new Set(eachDateKey(range)) : null;
  const ids = new Set<string>();
  for (const message of messages) {
    if (campaignId && message.campaignId !== campaignId) continue;
    if (!messageIsLeadReply(message)) continue;
    const key = toDateKey(message.sentAt);
    if (dateKey && key !== dateKey) continue;
    if (keys && !keys.has(key)) continue;
    ids.add(message.leadId);
  }
  return ids;
}

export function effectiveRepliedCount(
  campaign: Pick<Campaign, "id" | "repliedCount">,
  messages: OutreachMessage[] = [],
) {
  return Math.max(campaign.repliedCount, repliedLeadIds(messages, campaign.id).size);
}

export function countContactedLeads(leads: Lead[], campaignId?: string) {
  return leads.filter(
    (lead) => (!campaignId || lead.campaignId === campaignId) && leadWasContacted(lead),
  ).length;
}

export function countFlowMessages(leads: Lead[], campaignId?: string, range?: DateRange) {
  const keys = range ? new Set(eachDateKey(range)) : null;
  return leads.reduce((sum, lead) => {
    if (campaignId && lead.campaignId !== campaignId) return sum;
    return (
      sum +
      lead.history.filter(
        (event) =>
          FLOW_MESSAGE_EVENT_KINDS.includes(event.kind) &&
          (!keys || keys.has(toDateKey(event.at))),
      ).length
    );
  }, 0);
}

function flowSentOnDate(leads: Lead[], date: string) {
  return leads.reduce(
    (sum, lead) =>
      sum +
      lead.history.filter(
        (event) => FLOW_MESSAGE_EVENT_KINDS.includes(event.kind) && toDateKey(event.at) === date,
      ).length,
    0,
  );
}

export function sumStats(
  stats: DailyStat[],
  range: DateRange,
  leads: Lead[] = [],
  messages: OutreachMessage[] = [],
) {
  const keys = new Set(eachDateKey(range));
  const fromStats = stats.reduce((sum, stat) => {
    if (!keys.has(stat.date)) return sum;
    return sum + stat.repliedCount;
  }, 0);
  const repliedCount = Math.max(fromStats, repliedLeadIds(messages, undefined, range).size);
  const sentCount = leads.length
    ? countFlowMessages(leads, undefined, range)
    : stats.reduce((sum, stat) => {
        if (!keys.has(stat.date)) return sum;
        return sum + Number(stat.messages ?? 0) + Number(stat.inmails ?? 0);
      }, 0);
  return { sentCount, repliedCount };
}

export type ChartGrain = "day" | "week" | "month";

export interface ChartPoint {
  date: string;
  sentCount: number;
  repliedCount: number;
  successRate: number;
}

export function chartSeries(
  stats: DailyStat[],
  range: DateRange,
  leads: Lead[] = [],
  messages: OutreachMessage[] = [],
): ChartPoint[] {
  const byDate = new Map(stats.map((stat) => [stat.date, stat]));
  return eachDateKey(range).map((date) => {
    const stat = byDate.get(date);
    const sentCount = leads.length
      ? flowSentOnDate(leads, date)
      : Number(stat?.messages ?? 0) + Number(stat?.inmails ?? 0);
    const repliedCount = Math.max(
      stat?.repliedCount ?? 0,
      repliedLeadIds(messages, undefined, undefined, date).size,
    );
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

function acceptedInRange(leads: Lead[], range: DateRange) {
  const keys = new Set(eachDateKey(range));
  return leads.filter((lead) =>
    lead.history.some((event) => event.kind === "accepted" && keys.has(toDateKey(event.at))),
  ).length;
}

export function kpiMetrics(
  campaigns: Campaign[],
  stats: DailyStat[],
  range: DateRange,
  leads: Lead[] = [],
  messages: OutreachMessage[] = [],
) {
  const current = sumStats(stats, range, leads, messages);
  const previous = sumStats(stats, previousRange(range), leads, messages);
  const activeCampaigns = campaigns.filter((campaign) => isCampaignRunning(campaign.status)).length;
  const connectionCount = acceptedInRange(leads, range);
  const previousConnections = acceptedInRange(leads, previousRange(range));

  return {
    activeCampaigns,
    sentCount: current.sentCount,
    repliedCount: current.repliedCount,
    connectionCount,
    successRate: successRate(current.sentCount, current.repliedCount),
    sentTrend: trendPercent(current.sentCount, previous.sentCount),
    repliedTrend: trendPercent(current.repliedCount, previous.repliedCount),
    connectionTrend: trendPercent(connectionCount, previousConnections),
  };
}

export function failedLeads(leads: Lead[]) {
  return leads.filter((lead) => lead.status === "failed");
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
    if (campaign.status === "draft" || campaign.status === "completed" || campaign.status === "paused") {
      return false;
    }
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

function campaignHasActivity(
  campaign: Campaign,
  leads: Lead[] = [],
  messages: OutreachMessage[] = [],
) {
  return (
    campaign.sentCount > 0 ||
    campaign.repliedCount > 0 ||
    countFlowMessages(leads, campaign.id) > 0 ||
    repliedLeadIds(messages, campaign.id).size > 0
  );
}

export function bestCampaign(
  campaigns: Campaign[],
  leads: Lead[] = [],
  messages: OutreachMessage[] = [],
) {
  return [...campaigns]
    .filter((campaign) => campaignHasActivity(campaign, leads, messages))
    .sort((a, b) => {
      const aSent = countFlowMessages(leads, a.id) || a.sentCount;
      const bSent = countFlowMessages(leads, b.id) || b.sentCount;
      const aRate = successRate(aSent, effectiveRepliedCount(a, messages));
      const bRate = successRate(bSent, effectiveRepliedCount(b, messages));
      if (bRate !== aRate) return bRate - aRate;
      const replyDiff = effectiveRepliedCount(b, messages) - effectiveRepliedCount(a, messages);
      if (replyDiff !== 0) return replyDiff;
      return bSent - aSent;
    })[0];
}

export function mostRepliedCampaign(
  campaigns: Campaign[],
  messages: OutreachMessage[] = [],
  leads: Lead[] = [],
) {
  return [...campaigns]
    .filter((campaign) => campaignHasActivity(campaign, leads, messages))
    .sort((a, b) => {
      const replyDiff = effectiveRepliedCount(b, messages) - effectiveRepliedCount(a, messages);
      if (replyDiff !== 0) return replyDiff;
      return b.sentCount - a.sentCount;
    })[0];
}

export function lastSendBeforeReply(lead: Lead, replyAtOverride?: Date): LeadEvent | undefined {
  const replyAt =
    lead.history.find((event) => event.kind === "replied")?.at ??
    lead.firstReplyReceivedAt ??
    replyAtOverride;
  if (!replyAt) return undefined;
  return [...lead.history]
    .filter(
      (event) => SEND_EVENT_KINDS.includes(event.kind) && event.at.getTime() <= replyAt.getTime(),
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
}

export function averageReplyDays(leads: Lead[], messages: OutreachMessage[] = []) {
  const samples: number[] = [];
  for (const lead of leads) {
    const inbound = messages
      .filter((message) => message.leadId === lead.id && message.direction === "inbound")
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())[0];
    const replyAt =
      lead.history.find((event) => event.kind === "replied")?.at ??
      lead.firstReplyReceivedAt ??
      inbound?.sentAt;
    const send = lastSendBeforeReply(lead, inbound?.sentAt);
    if (!replyAt || !send) continue;
    const ms = replyAt.getTime() - send.at.getTime();
    if (ms >= 0) samples.push(ms / 86_400_000);
  }
  if (samples.length === 0) return null;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

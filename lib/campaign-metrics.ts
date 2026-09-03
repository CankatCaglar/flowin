import { flowStepCounts } from "@/lib/campaign-flow";
import { averageReplyDays, lastSendBeforeReply } from "@/lib/metrics";
import { successRate } from "@/lib/utils";
import type { Campaign, CampaignFlowStep, DailyStat, Lead, LeadEventKind } from "@/types";

export function bestStatDay(stats: DailyStat[]) {
  return [...stats]
    .filter((stat) => stat.sentCount > 0)
    .sort(
      (a, b) =>
        successRate(b.sentCount, b.repliedCount) - successRate(a.sentCount, a.repliedCount),
    )[0];
}

function stepForSendKind(flow: CampaignFlowStep[], kind: LeadEventKind) {
  if (kind === "connection_sent") return flow.find((step) => step.kind === "connection");
  if (kind === "inmail_sent") return flow.find((step) => step.kind === "inmail");
  const messages = flow.filter((step) => step.kind === "message" && step.templateKey !== "respond");
  if (kind === "message_1_sent") {
    return flow.find((step) => step.templateKey === "message1") ?? messages[0];
  }
  if (kind === "message_2_sent") {
    return flow.find((step) => step.templateKey === "message2") ?? messages[1];
  }
  if (kind === "message_3_sent") {
    return flow.find((step) => step.templateKey === "message3") ?? messages[2];
  }
  return undefined;
}

export function topRepliedStep(campaign: Campaign, leads: Lead[]) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.campaignId !== campaign.id) continue;
    const send = lastSendBeforeReply(lead);
    if (!send) continue;
    const step = stepForSendKind(campaign.flow, send.kind);
    if (!step) continue;
    counts.set(step.id, (counts.get(step.id) ?? 0) + 1);
  }

  let bestId = "";
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }
  if (!bestId || bestCount <= 0) return undefined;

  const step = campaign.flow.find((item) => item.id === bestId);
  if (!step) return undefined;
  const sent = flowStepCounts(campaign, step.id);
  return {
    step,
    rate: sent > 0 ? (bestCount / sent) * 100 : 0,
  };
}

export function campaignReplyDays(leads: Lead[], campaignId: string) {
  return averageReplyDays(leads.filter((lead) => lead.campaignId === campaignId));
}

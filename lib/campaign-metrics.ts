import { flowStepCounts } from "@/lib/campaign-flow";
import { averageReplyDays, lastSendBeforeReply, repliedLeadIds } from "@/lib/metrics";
import { successRate } from "@/lib/utils";
import type { Campaign, CampaignFlowStep, DailyStat, Lead, LeadEventKind, OutreachMessage } from "@/types";

export function bestStatDay(
  stats: DailyStat[],
  messages: OutreachMessage[] = [],
  campaignId?: string,
) {
  const sentOf = (stat: DailyStat) => Number(stat.messages ?? 0) + Number(stat.inmails ?? 0);
  return [...stats]
    .filter((stat) => sentOf(stat) > 0 || stat.sentCount > 0)
    .sort((a, b) => {
      const aReplied = Math.max(a.repliedCount, repliedLeadIds(messages, campaignId, undefined, a.date).size);
      const bReplied = Math.max(b.repliedCount, repliedLeadIds(messages, campaignId, undefined, b.date).size);
      return (
        successRate(sentOf(b) || b.sentCount, bReplied) -
        successRate(sentOf(a) || a.sentCount, aReplied)
      );
    })[0];
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

export function topRepliedStep(campaign: Campaign, leads: Lead[], messages: OutreachMessage[] = []) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.campaignId !== campaign.id) continue;
    const inbound = messages
      .filter((message) => message.leadId === lead.id && message.direction === "inbound")
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())[0];
    const send = lastSendBeforeReply(lead, inbound?.sentAt);
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

export function campaignReplyDays(
  leads: Lead[],
  campaignId: string,
  messages: OutreachMessage[] = [],
) {
  return averageReplyDays(
    leads.filter((lead) => lead.campaignId === campaignId),
    messages,
  );
}

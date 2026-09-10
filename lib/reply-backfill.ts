import "server-only";
import { messageIsLeadReply } from "@/lib/chat-thread";
import { fetchCampaign, fetchLeads } from "@/lib/outreach-data";
import { markLeadReplied } from "@/lib/sequence-runner";
import type { OutreachMessage } from "@/types";

export async function backfillRepliesFromMessages(
  brandId: string,
  messages: OutreachMessage[],
) {
  const repliedIds = new Set(messages.filter(messageIsLeadReply).map((item) => item.leadId));
  if (repliedIds.size === 0) return;
  const leads = await fetchLeads(brandId);
  for (const lead of leads) {
    if (!repliedIds.has(lead.id) || lead.status === "replied") continue;
    const campaign = await fetchCampaign(lead.campaignId);
    if (!campaign) continue;
    const sample =
      messages.find((item) => item.leadId === lead.id && item.direction === "inbound")?.body ??
      messages.find((item) => item.leadId === lead.id && (item.reactions?.length ?? 0) > 0)
        ?.reactions?.[0] ??
      "";
    await markLeadReplied(lead, campaign, sample || "👏", { skipInbox: true });
  }
}

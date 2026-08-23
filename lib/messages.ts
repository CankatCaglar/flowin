import type { Campaign, DerivedMessage, Lead } from "@/types";

export function deriveMessages(leads: Lead[], campaigns: Campaign[]): DerivedMessage[] {
  const names = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
  const rows: DerivedMessage[] = [];

  leads.forEach((lead) => {
    rows.push({
      id: `${lead.id}-out`,
      leadId: lead.id,
      leadName: lead.fullName,
      campaignId: lead.campaignId,
      campaignName: names.get(lead.campaignId) ?? lead.campaignId,
      direction: "outbound",
      sentAt: lead.lastMessageSentAt,
    });

    if (lead.firstReplyReceivedAt) {
      rows.push({
        id: `${lead.id}-in`,
        leadId: lead.id,
        leadName: lead.fullName,
        campaignId: lead.campaignId,
        campaignName: names.get(lead.campaignId) ?? lead.campaignId,
        direction: "inbound",
        sentAt: lead.firstReplyReceivedAt,
      });
    }
  });

  return rows.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

import "server-only";
import { fetchBrand } from "@/lib/data";
import {
  createMessage,
  fetchCampaign,
  fetchLead,
  incrementCampaignCounters,
  incrementDailyStat,
  saveLead,
} from "@/lib/outreach-data";
import { getUnipileProfile, sendUnipileChatMessage, UnipileError } from "@/lib/unipile";

const MAX_BODY = 4000;

export async function sendManualLeadMessage(input: {
  brandId: string;
  leadId: string;
  body: string;
}) {
  const body = input.body.trim();
  if (!body || body.length > MAX_BODY) throw new Error("invalid");

  const [lead, brand] = await Promise.all([fetchLead(input.leadId), fetchBrand(input.brandId)]);
  if (!lead || !brand || lead.brandId !== input.brandId) throw new Error("not-found");
  if (brand.archived || brand.outreachPaused) throw new Error("outreach-paused");
  if (brand.testMode) throw new Error("test-mode");
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) {
    throw new Error("seat-disconnected");
  }

  const campaign = await fetchCampaign(lead.campaignId);
  if (!campaign) throw new Error("not-found");

  let providerId = lead.unipileProviderId?.trim() ?? "";
  if (!providerId) {
    const identifier = lead.linkedinPublicId || lead.linkedinUrl;
    if (!identifier) throw new Error("missing-linkedin");
    const profile = await getUnipileProfile(brand.unipileAccountId, identifier);
    providerId = profile.provider_id ?? "";
    if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
    lead.unipileProviderId = providerId;
  }
  if (!providerId) throw new Error("missing-linkedin");

  try {
    const sent = await sendUnipileChatMessage({
      accountId: brand.unipileAccountId,
      chatId: lead.unipileChatId,
      attendeeId: providerId,
      text: body,
    });
    lead.unipileChatId = sent.chat_id || sent.id || lead.unipileChatId;
  } catch (error) {
    if (error instanceof UnipileError && (error.status === 400 || error.status === 403 || error.status === 422)) {
      throw new Error("not-connected");
    }
    throw error;
  }

  lead.lastMessageSentAt = new Date();
  await saveLead(lead);

  const message = await createMessage({
    brandId: lead.brandId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    leadId: lead.id,
    leadName: lead.fullName,
    direction: "outbound",
    body,
    sentAt: new Date(),
  });
  await incrementDailyStat(lead.brandId, { sent: 1, messages: 1 }, campaign.id);
  await incrementCampaignCounters(campaign.id, { sent: 1 });
  return message;
}

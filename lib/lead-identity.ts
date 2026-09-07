import { isCampaignRunning } from "@/lib/campaign-status";
import { linkedInPublicId, normalizeLinkedInUrl } from "@/lib/linkedin-profile";
import type { Campaign, Lead } from "@/types";

export type LeadIdentity = {
  id?: string;
  campaignId?: string;
  linkedinUrl?: string;
  linkedinPublicId?: string;
  unipileProviderId?: string;
  history?: Lead["history"];
  lastMessageSentAt?: Date;
};

export class DuplicateActiveLeadError extends Error {
  campaignId: string;
  campaignName: string;

  constructor(campaignId: string, campaignName: string) {
    super("duplicate-active");
    this.name = "DuplicateActiveLeadError";
    this.campaignId = campaignId;
    this.campaignName = campaignName;
  }
}

export function leadIdentityKeys(input: LeadIdentity): string[] {
  const keys = new Set<string>();
  const url = normalizeLinkedInUrl(input.linkedinUrl ?? "");
  const publicId = (input.linkedinPublicId?.trim() || linkedInPublicId(url || input.linkedinUrl || ""))
    .replace(/\/+$/, "")
    .toLocaleLowerCase();
  if (publicId) keys.add(`pid:${publicId}`);
  if (url) {
    const clean = url.split("#")[0]?.split("?")[0]?.replace(/\/+$/, "").toLocaleLowerCase() ?? "";
    if (clean) keys.add(`url:${clean}`);
  }
  const provider = input.unipileProviderId?.trim();
  if (provider) keys.add(`prv:${provider}`);
  return [...keys];
}

export function leadsShareIdentity(a: LeadIdentity, b: LeadIdentity) {
  const left = new Set(leadIdentityKeys(a));
  if (left.size === 0) return false;
  return leadIdentityKeys(b).some((key) => left.has(key));
}

export function leadAddedAt(lead: LeadIdentity): Date {
  const added = lead.history?.find((event) => event.kind === "added");
  return added?.at ?? lead.history?.[0]?.at ?? lead.lastMessageSentAt ?? new Date(0);
}

export function findActiveOccupant(
  leads: Lead[],
  campaigns: Campaign[],
  identity: LeadIdentity,
  exceptLeadId?: string,
): { lead: Lead; campaign: Campaign } | null {
  const incoming = new Set(leadIdentityKeys(identity));
  if (incoming.size === 0) return null;
  const running = new Set(
    campaigns.filter((campaign) => isCampaignRunning(campaign.status)).map((campaign) => campaign.id),
  );
  const matches = leads.filter((lead) => {
    if (exceptLeadId && lead.id === exceptLeadId) return false;
    if (!running.has(lead.campaignId)) return false;
    return leadIdentityKeys(lead).some((key) => incoming.has(key));
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const delta = leadAddedAt(a).getTime() - leadAddedAt(b).getTime();
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
  const owner = matches[0];
  const campaign = campaigns.find((item) => item.id === owner.campaignId);
  if (!campaign) return null;
  return { lead: owner, campaign };
}

export function partitionAgainstActiveCampaigns<T extends LeadIdentity>(
  incoming: T[],
  existing: Lead[],
  campaigns: Campaign[],
) {
  const skipped: Array<{ item: T; campaignName: string; campaignId: string }> = [];
  const kept: T[] = [];
  for (const item of incoming) {
    const occupant = findActiveOccupant(existing, campaigns, item);
    if (occupant) {
      skipped.push({
        item,
        campaignName: occupant.campaign.name,
        campaignId: occupant.campaign.id,
      });
      continue;
    }
    kept.push(item);
  }
  return { kept, skipped };
}

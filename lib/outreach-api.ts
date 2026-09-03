import { hydrateCampaignDates } from "@/lib/storage";
import type {
  BrandPacing,
  Campaign,
  CampaignFlowStep,
  CampaignStatus,
  DailyStat,
  Lead,
  OutreachMessage,
} from "@/types";

async function request(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error("network");
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "request-failed";
    throw new Error(error);
  }
  return data as T;
}

function hydrateLeadDates(lead: Lead): Lead {
  return {
    ...lead,
    lastMessageSentAt:
      lead.lastMessageSentAt instanceof Date
        ? lead.lastMessageSentAt
        : new Date(lead.lastMessageSentAt),
    firstReplyReceivedAt: lead.firstReplyReceivedAt
      ? lead.firstReplyReceivedAt instanceof Date
        ? lead.firstReplyReceivedAt
        : new Date(lead.firstReplyReceivedAt)
      : undefined,
    nextStepAt: lead.nextStepAt
      ? lead.nextStepAt instanceof Date
        ? lead.nextStepAt
        : new Date(lead.nextStepAt)
      : undefined,
    history: (lead.history ?? []).map((event) => ({
      ...event,
      at: event.at instanceof Date ? event.at : new Date(event.at),
    })),
  };
}

function hydrateMessageDates(message: OutreachMessage): OutreachMessage {
  return {
    ...message,
    sentAt: message.sentAt instanceof Date ? message.sentAt : new Date(message.sentAt),
  };
}

export async function fetchCampaigns(brandId: string): Promise<Campaign[]> {
  const response = await request(`/api/campaigns?brandId=${encodeURIComponent(brandId)}`);
  const rows = await readJson<Campaign[]>(response);
  return rows.map(hydrateCampaignDates);
}

export async function createCampaign(input: {
  brandId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  targetAudience: string;
  leadGoal: number;
  flow: CampaignFlowStep[];
  status?: CampaignStatus;
  copyFromCampaignId?: string;
  leads?: Array<{
    fullName: string;
    linkedinUrl: string;
    company?: string;
    position?: string;
    email?: string;
    phone?: string;
    unipileProviderId?: string;
    pictureUrl?: string;
  }>;
}): Promise<Campaign> {
  const response = await request("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return hydrateCampaignDates(await readJson<Campaign>(response));
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, "name" | "flow" | "status" | "targetAudience" | "leadGoal">>,
) {
  const response = await request(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return hydrateCampaignDates(await readJson<Campaign>(response));
}

export async function fetchLeads(brandId: string): Promise<Lead[]> {
  const response = await request(`/api/leads?brandId=${encodeURIComponent(brandId)}`);
  const rows = await readJson<Lead[]>(response);
  return rows.map(hydrateLeadDates);
}

export async function hydrateLeadAvatars(brandId: string): Promise<{
  avatars: Record<string, string>;
  companies: Record<string, string>;
}> {
  const response = await request("/api/leads/avatars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId }),
  });
  const data = await readJson<{ avatars?: Record<string, string>; companies?: Record<string, string> }>(
    response,
  );
  return { avatars: data.avatars ?? {}, companies: data.companies ?? {} };
}

export function leadNeedsAvatarHydration(lead: Lead) {
  const path = (lead.avatarUrl ?? "").split("?")[0] ?? "";
  if (path.startsWith("/api/leads/") && path.endsWith("/avatar")) return false;
  if (path === "none") return false;
  return !lead.avatarChecked || !path;
}

export async function createLead(input: {
  brandId: string;
  campaignId: string;
  fullName: string;
  linkedinUrl: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  unipileProviderId?: string;
  pictureUrl?: string;
}): Promise<Lead> {
  const response = await request("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return hydrateLeadDates(await readJson<Lead>(response));
}

export async function fetchMessages(brandId: string): Promise<OutreachMessage[]> {
  const response = await request(`/api/messages?brandId=${encodeURIComponent(brandId)}`);
  const rows = await readJson<OutreachMessage[]>(response);
  return rows.map(hydrateMessageDates);
}

export async function fetchDailyStats(brandId: string, campaignId?: string): Promise<DailyStat[]> {
  const query = new URLSearchParams({ brandId });
  if (campaignId) query.set("campaignId", campaignId);
  const response = await request(`/api/stats?${query}`);
  return readJson<DailyStat[]>(response);
}

export async function importLeadFromUrl(brandId: string, url: string) {
  const response = await request("/api/leads/from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, url }),
  });
  return readJson<{
    lead: {
      fullName: string;
      linkedinUrl: string;
      company: string;
      position: string;
      unipileProviderId?: string;
      pictureUrl?: string;
    };
  }>(response);
}

export async function importSalesNavLeads(brandId: string, url: string) {
  const response = await request("/api/sales-nav/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, url }),
  });
  return readJson<{
    leads: Array<{
      fullName: string;
      linkedinUrl: string;
      company: string;
      position: string;
      unipileProviderId?: string;
      pictureUrl?: string;
    }>;
  }>(response);
}

export async function updateBrandPacing(brandId: string, pacing: BrandPacing) {
  const response = await request(`/api/brands/${encodeURIComponent(brandId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pacing }),
  });
  return readJson(response);
}

import { defaultCampaignFlow } from "@/lib/campaign-flow";
import {
  getSeedBrandStats,
  seedCampaigns,
  seedDailyStats,
  seedLeads,
} from "@/lib/seed";
import {
  hydrateCampaignDates,
  readCampaignOverlay,
  readLeadOverlay,
  writeCampaignOverlay,
  writeLeadOverlay,
} from "@/lib/storage";
import {
  asLeadStage,
  asLeadStatus,
  isLeadEventKind,
  lastOutboundAt,
  synthesizeHistory,
} from "@/lib/leads";
import type {
  Campaign,
  CampaignFlowStep,
  CampaignStatus,
  DailyStat,
  FlowDelayUnit,
  Lead,
  LeadEvent,
} from "@/types";

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

function hydrateHistory(
  input: unknown,
  stage: Lead["stage"],
  status: Lead["status"],
  lastActionAt: Date,
  firstReplyReceivedAt?: Date,
): LeadEvent[] {
  if (Array.isArray(input)) {
    const events = input
      .filter((event): event is { kind: LeadEvent["kind"]; at: unknown } => {
        return Boolean(
          event &&
            typeof event === "object" &&
            "kind" in event &&
            isLeadEventKind((event as { kind: unknown }).kind),
        );
      })
      .map((event) => ({
        kind: event.kind,
        at: asDate(event.at),
      }));
    if (events.length > 0) return events;
  }
  return synthesizeHistory(stage, status, lastActionAt, firstReplyReceivedAt);
}

function hydrateCampaign(input: Partial<Campaign> & Pick<Campaign, "id" | "brandId" | "name">): Campaign {
  const startDate = asDate(input.startDate);
  const stored = Array.isArray(input.flow) ? input.flow : [];
  const branched = stored.some((step) => Boolean(step.branch));
  const flow = (branched ? stored : defaultCampaignFlow()).map((step) => ({
    ...step,
    delayDays: Number(step.delayDays ?? 0),
    delayUnit: (step.delayUnit === "hours" ? "hours" : "days") as FlowDelayUnit,
    premium: Boolean(step.premium),
  }));
  return hydrateCampaignDates({
    id: input.id,
    brandId: input.brandId,
    name: input.name,
    status: (input.status as CampaignStatus) ?? "draft",
    sentCount: Number(input.sentCount ?? 0),
    repliedCount: Number(input.repliedCount ?? 0),
    startDate,
    endDate: asDate(input.endDate ?? startDate),
    createdAt: asDate(input.createdAt ?? startDate),
    targetAudience: String(input.targetAudience ?? input.name),
    leadGoal: Number(input.leadGoal ?? input.sentCount ?? 0),
    flow,
  });
}

function hydrateLead(input: Partial<Lead> & Pick<Lead, "id" | "brandId" | "campaignId" | "fullName">): Lead {
  const legacyStage = String(input.stage ?? "");
  const status = legacyStage === "failed" ? "failed" : asLeadStatus(input.status);
  const stage = asLeadStage(input.stage, status);
  const firstReplyReceivedAt = input.firstReplyReceivedAt
    ? asDate(input.firstReplyReceivedAt)
    : undefined;
  const fallbackActionAt = asDate(input.lastMessageSentAt);
  const history = hydrateHistory(
    input.history,
    stage,
    status,
    fallbackActionAt,
    firstReplyReceivedAt,
  );
  const slug = input.fullName.toLowerCase().replace(/\s+/g, ".");
  return {
    id: input.id,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName,
    linkedinUrl: String(input.linkedinUrl ?? ""),
    status,
    lastMessageSentAt: lastOutboundAt(history, fallbackActionAt),
    firstReplyReceivedAt:
      firstReplyReceivedAt ??
      history.find((event) => event.kind === "replied")?.at,
    company: String(input.company ?? "—"),
    position: String(input.position ?? "—"),
    stage,
    email: String(input.email ?? `${slug}@example.com`),
    phone: String(input.phone ?? ""),
    history,
  };
}

function mergeCampaigns(brandId: string, base: Campaign[]): Campaign[] {
  const overlay = readCampaignOverlay();
  const deleted = new Set(overlay.deleted ?? []);
  const updated = base.map((campaign) => {
    const patch = overlay.updates[campaign.id];
    return hydrateCampaign({ ...campaign, ...patch, id: campaign.id, brandId: campaign.brandId });
  });
  const created = overlay.created
    .filter((campaign) => campaign.brandId === brandId)
    .map((campaign) => hydrateCampaign(campaign));
  return [...updated, ...created].filter(
    (campaign) => !deleted.has(campaign.id) && campaign.brandId === brandId,
  );
}

function mergeLeads(brandId: string, base: Lead[]): Lead[] {
  const overlay = readLeadOverlay();
  const created = overlay.created
    .filter((lead) => lead.brandId === brandId)
    .map((lead) =>
      hydrateLead({
        ...lead,
        id: lead.id,
        brandId: lead.brandId,
        campaignId: lead.campaignId,
        fullName: lead.fullName,
      }),
    );
  return [...base.map((lead) => hydrateLead(lead)), ...created];
}

export async function fetchCampaigns(brandId: string): Promise<Campaign[]> {
  return mergeCampaigns(
    brandId,
    seedCampaigns.filter((campaign) => campaign.brandId === brandId),
  );
}

export async function fetchLeads(brandId: string): Promise<Lead[]> {
  return mergeLeads(
    brandId,
    seedLeads.filter((lead) => lead.brandId === brandId),
  );
}

export async function fetchDailyStats(brandId: string): Promise<DailyStat[]> {
  return seedDailyStats[brandId] ?? [];
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
}) {
  const payload: Campaign = {
    id: `local-${crypto.randomUUID()}`,
    brandId: input.brandId,
    name: input.name.trim(),
    status: input.status ?? "draft",
    sentCount: 0,
    repliedCount: 0,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: new Date(),
    targetAudience: input.targetAudience.trim() || input.name.trim(),
    leadGoal: input.leadGoal,
    flow: input.flow,
  };
  const overlay = readCampaignOverlay();
  overlay.created.push(payload);
  writeCampaignOverlay(overlay);
  return payload;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, "name" | "flow" | "status" | "targetAudience" | "leadGoal">>,
) {
  const overlay = readCampaignOverlay();
  const createdIndex = overlay.created.findIndex((campaign) => campaign.id === campaignId);
  if (createdIndex >= 0) {
    overlay.created[createdIndex] = { ...overlay.created[createdIndex], ...patch };
  } else {
    overlay.updates[campaignId] = { ...overlay.updates[campaignId], ...patch };
  }
  writeCampaignOverlay(overlay);
}

function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
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
}) {
  const addedAt = new Date();
  const payload: Lead = {
    id: `local-lead-${crypto.randomUUID()}`,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName.trim(),
    linkedinUrl: normalizeLinkedInUrl(input.linkedinUrl),
    status: "queued",
    lastMessageSentAt: addedAt,
    company: input.company?.trim() || "—",
    position: input.position?.trim() || "—",
    stage: "connection_request",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    history: [{ kind: "added", at: addedAt }],
  };
  const overlay = readLeadOverlay();
  overlay.created.push(payload);
  writeLeadOverlay(overlay);
  return payload;
}

export function brandCardStats(brandId: string, campaigns?: Campaign[]) {
  if (campaigns) {
    const sent = campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0);
    const replied = campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0);
    return {
      activeCampaigns: campaigns.filter(
        (campaign) => campaign.status === "active" || campaign.status === "expiring",
      ).length,
      successRate: sent > 0 ? (replied / sent) * 100 : 0,
    };
  }
  return getSeedBrandStats(brandId);
}

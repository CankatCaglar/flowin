import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  copyLeadAvatar,
  deleteLeadAvatar,
  ingestLeadAvatar,
  isRemoteAvatarUrl,
  isStoredLeadAvatarUrl,
  leadAvatarUrl,
} from "@/lib/brand-avatar";
import { defaultCampaignFlow } from "@/lib/campaign-flow";
import { requireFirebaseDb } from "@/lib/firebase";
import { asLeadStage, asLeadStatus, deriveLeadStage, isLeadEventKind, lastOutboundAt } from "@/lib/leads";
import { linkedInPublicId, normalizeLinkedInUrl } from "@/lib/linkedin-profile";
import { asCampaignStatus, isCampaignRunning } from "@/lib/campaign-status";
import { firstOpenStep, scheduleAt } from "@/lib/sequence";
import { hydrateCampaignDates } from "@/lib/storage";
import { toDateKey } from "@/lib/dates";
import type {
  Campaign,
  CampaignFlowStep,
  CampaignStatus,
  DailyStat,
  FlowDelayUnit,
  Lead,
  LeadEvent,
  OutreachMessage,
} from "@/types";

function asDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) return next;
  }
  return fallback;
}

function asDateOrUndefined(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return asDate(value);
}

function hydrateFlow(input: unknown): CampaignFlowStep[] {
  const stored = Array.isArray(input) ? input : [];
  const branched = stored.some((step) => Boolean((step as CampaignFlowStep).branch));
  const source = (branched ? stored : defaultCampaignFlow()) as CampaignFlowStep[];
  return source.map((step) => ({
    ...step,
    delayDays: Number(step.delayDays ?? 0),
    delayUnit: (step.delayUnit === "hours" ? "hours" : "days") as FlowDelayUnit,
    premium: Boolean(step.premium),
  }));
}

function hydrateHistory(input: unknown): LeadEvent[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((event): event is { kind: LeadEvent["kind"]; at: unknown } => {
      return Boolean(
        event &&
          typeof event === "object" &&
          "kind" in event &&
          isLeadEventKind((event as { kind: unknown }).kind),
      );
    })
    .map((event) => ({ kind: event.kind, at: asDate(event.at) }));
}

export function hydrateCampaign(
  input: Partial<Campaign> & Pick<Campaign, "id" | "brandId" | "name">,
): Campaign {
  const startDate = asDate(input.startDate);
  return hydrateCampaignDates({
    id: input.id,
    brandId: input.brandId,
    name: String(input.name ?? ""),
    status: asCampaignStatus(input.status),
    sentCount: Number(input.sentCount ?? 0),
    repliedCount: Number(input.repliedCount ?? 0),
    startDate,
    endDate: asDate(input.endDate ?? startDate),
    createdAt: asDate(input.createdAt ?? startDate),
    targetAudience: String(input.targetAudience ?? input.name),
    leadGoal: Number(input.leadGoal ?? 0),
    flow: hydrateFlow(input.flow),
    stepCounts:
      input.stepCounts && typeof input.stepCounts === "object" ? input.stepCounts : {},
  });
}

export function hydrateLead(
  input: Partial<Lead> & Pick<Lead, "id" | "brandId" | "campaignId" | "fullName">,
): Lead {
  const status = asLeadStatus(input.status);
  const history = hydrateHistory(input.history);
  const stage = deriveLeadStage({
    status,
    stage: asLeadStage(input.stage, status),
    history,
  });
  const fallbackActionAt = asDate(input.lastMessageSentAt);
  const firstReplyReceivedAt =
    asDateOrUndefined(input.firstReplyReceivedAt) ??
    history.find((event) => event.kind === "replied")?.at;
  return {
    id: input.id,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName,
    linkedinUrl: String(input.linkedinUrl ?? ""),
    linkedinPublicId: String(input.linkedinPublicId ?? linkedInPublicId(String(input.linkedinUrl ?? ""))),
    unipileProviderId: String(input.unipileProviderId ?? ""),
    unipileChatId: String(input.unipileChatId ?? ""),
    avatarUrl: String(input.avatarUrl ?? ""),
    avatarChecked: Boolean(input.avatarChecked),
    status,
    lastMessageSentAt: lastOutboundAt(history, fallbackActionAt),
    firstReplyReceivedAt,
    company: String(input.company ?? ""),
    position: String(input.position ?? ""),
    stage,
    email: String(input.email ?? ""),
    phone: String(input.phone ?? ""),
    history,
    nextStepId: String(input.nextStepId ?? ""),
    nextStepAt: asDateOrUndefined(input.nextStepAt),
    currentBranch: (input.currentBranch as Lead["currentBranch"]) ?? "",
    awaiting: (input.awaiting as Lead["awaiting"]) ?? "",
    failReason: String(input.failReason ?? ""),
  };
}

export function hydrateMessage(
  input: Partial<OutreachMessage> & Pick<OutreachMessage, "id">,
): OutreachMessage {
  return {
    id: input.id,
    brandId: String(input.brandId ?? ""),
    campaignId: String(input.campaignId ?? ""),
    campaignName: String(input.campaignName ?? ""),
    leadId: String(input.leadId ?? ""),
    leadName: String(input.leadName ?? ""),
    direction: input.direction === "inbound" ? "inbound" : "outbound",
    body: String(input.body ?? ""),
    sentAt: asDate(input.sentAt),
    unipileMessageId: String(input.unipileMessageId ?? ""),
  };
}

function campaignPayload(campaign: Campaign) {
  return {
    brandId: campaign.brandId,
    name: campaign.name,
    status: campaign.status,
    sentCount: campaign.sentCount,
    repliedCount: campaign.repliedCount,
    startDate: Timestamp.fromDate(campaign.startDate),
    endDate: Timestamp.fromDate(campaign.endDate),
    createdAt: Timestamp.fromDate(campaign.createdAt),
    targetAudience: campaign.targetAudience,
    leadGoal: campaign.leadGoal,
    flow: campaign.flow,
    stepCounts: campaign.stepCounts ?? {},
  };
}

function leadPayload(lead: Lead) {
  return {
    brandId: lead.brandId,
    campaignId: lead.campaignId,
    fullName: lead.fullName,
    linkedinUrl: lead.linkedinUrl,
    linkedinPublicId: lead.linkedinPublicId ?? "",
    unipileProviderId: lead.unipileProviderId ?? "",
    unipileChatId: lead.unipileChatId ?? "",
    avatarUrl: lead.avatarUrl ?? "",
    avatarChecked: lead.avatarChecked ?? false,
    status: lead.status,
    lastMessageSentAt: Timestamp.fromDate(lead.lastMessageSentAt),
    firstReplyReceivedAt: lead.firstReplyReceivedAt
      ? Timestamp.fromDate(lead.firstReplyReceivedAt)
      : null,
    company: lead.company,
    position: lead.position,
    stage: lead.stage,
    email: lead.email,
    phone: lead.phone,
    history: lead.history.map((event) => ({
      kind: event.kind,
      at: Timestamp.fromDate(event.at),
    })),
    nextStepId: lead.nextStepId ?? "",
    nextStepAt: lead.nextStepAt ? Timestamp.fromDate(lead.nextStepAt) : null,
    currentBranch: lead.currentBranch ?? "",
    awaiting: lead.awaiting ?? "",
    failReason: lead.failReason ?? "",
  };
}

export async function fetchCampaigns(brandId: string): Promise<Campaign[]> {
  const snapshot = await requireFirebaseDb()
    .collection("campaigns")
    .where("brandId", "==", brandId)
    .get();
  return snapshot.docs
    .map((item) =>
      hydrateCampaign({
        id: item.id,
        ...(item.data() as Partial<Campaign>),
        brandId,
        name: String(item.data().name ?? ""),
      }),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function fetchCampaign(campaignId: string) {
  const snapshot = await requireFirebaseDb().collection("campaigns").doc(campaignId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  return hydrateCampaign({
    id: snapshot.id,
    ...(data as Partial<Campaign>),
    brandId: String(data.brandId ?? ""),
    name: String(data.name ?? ""),
  });
}

export async function fetchAllActiveCampaigns() {
  const snapshot = await requireFirebaseDb()
    .collection("campaigns")
    .where("status", "in", ["active", "expiring"])
    .get();
  return snapshot.docs.map((item) =>
    hydrateCampaign({
      id: item.id,
      ...(item.data() as Partial<Campaign>),
      brandId: String(item.data().brandId ?? ""),
      name: String(item.data().name ?? ""),
    }),
  );
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
  const db = requireFirebaseDb();
  const ref = db.collection("campaigns").doc();
  const createdAt = new Date();
  const campaign = hydrateCampaign({
    id: ref.id,
    brandId: input.brandId,
    name: input.name.trim(),
    status: input.status ?? "draft",
    sentCount: 0,
    repliedCount: 0,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt,
    targetAudience: input.targetAudience.trim() || input.name.trim(),
    leadGoal: input.leadGoal,
    flow: input.flow,
    stepCounts: {},
  });
  await ref.create(campaignPayload(campaign));
  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<
    Pick<
      Campaign,
      "name" | "flow" | "status" | "targetAudience" | "leadGoal" | "sentCount" | "repliedCount" | "stepCounts"
    >
  >,
) {
  const db = requireFirebaseDb();
  const ref = db.collection("campaigns").doc(campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("not-found");
  const current = hydrateCampaign({
    id: snapshot.id,
    ...(snapshot.data() as Partial<Campaign>),
    brandId: String(snapshot.data()?.brandId ?? ""),
    name: String(snapshot.data()?.name ?? ""),
  });
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as typeof patch;
  const next = hydrateCampaign({
    ...current,
    ...clean,
    id: current.id,
    brandId: current.brandId,
    name: typeof clean.name === "string" ? clean.name : current.name,
  });
  await ref.update(campaignPayload(next));
  const becameActive = isCampaignRunning(next.status) && !isCampaignRunning(current.status);
  if (becameActive) {
    const leads = await fetchLeadsByCampaign(campaignId);
    for (const lead of leads) {
      if (lead.status !== "queued" || lead.nextStepAt) continue;
      const schedule = initialSchedule(next.flow, true);
      lead.nextStepId = schedule.nextStepId;
      lead.nextStepAt = schedule.nextStepAt;
      await saveLead(lead);
    }
  }
  return next;
}

export async function incrementCampaignCounters(
  campaignId: string,
  patch: { sent?: number; replied?: number; stepId?: string },
) {
  const db = requireFirebaseDb();
  const ref = db.collection("campaigns").doc(campaignId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const current = snapshot.data() ?? {};
  const stepCounts = {
    ...((current.stepCounts as Record<string, number> | undefined) ?? {}),
  };
  if (patch.stepId) {
    stepCounts[patch.stepId] = Number(stepCounts[patch.stepId] ?? 0) + 1;
  }
  await ref.update({
    sentCount: Number(current.sentCount ?? 0) + (patch.sent ?? 0),
    repliedCount: Number(current.repliedCount ?? 0) + (patch.replied ?? 0),
    stepCounts,
  });
}

export async function fetchLeads(brandId: string): Promise<Lead[]> {
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("brandId", "==", brandId)
    .get();
  return snapshot.docs
    .map((item) =>
      hydrateLead({
        id: item.id,
        ...(item.data() as Partial<Lead>),
        brandId,
        campaignId: String(item.data().campaignId ?? ""),
        fullName: String(item.data().fullName ?? ""),
      }),
    )
    .sort((a, b) => b.lastMessageSentAt.getTime() - a.lastMessageSentAt.getTime());
}

export async function fetchLeadsByCampaign(campaignId: string) {
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("campaignId", "==", campaignId)
    .get();
  return snapshot.docs.map((item) =>
    hydrateLead({
      id: item.id,
      ...(item.data() as Partial<Lead>),
      brandId: String(item.data().brandId ?? ""),
      campaignId,
      fullName: String(item.data().fullName ?? ""),
    }),
  );
}

export async function fetchDueLeads(now = new Date()) {
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("nextStepAt", "<=", Timestamp.fromDate(now))
    .get();
  return snapshot.docs
    .map((item) =>
      hydrateLead({
        id: item.id,
        ...(item.data() as Partial<Lead>),
        brandId: String(item.data().brandId ?? ""),
        campaignId: String(item.data().campaignId ?? ""),
        fullName: String(item.data().fullName ?? ""),
      }),
    )
    .filter((lead) => lead.status === "queued" || lead.status === "waiting_reply");
}

export async function fetchLead(leadId: string) {
  const snapshot = await requireFirebaseDb().collection("leads").doc(leadId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  return hydrateLead({
    id: snapshot.id,
    ...(data as Partial<Lead>),
    brandId: String(data.brandId ?? ""),
    campaignId: String(data.campaignId ?? ""),
    fullName: String(data.fullName ?? ""),
  });
}

export async function findLeadByProvider(brandId: string, providerId: string) {
  if (!providerId) return null;
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("brandId", "==", brandId)
    .where("unipileProviderId", "==", providerId)
    .limit(1)
    .get();
  const item = snapshot.docs[0];
  if (!item) return null;
  return hydrateLead({
    id: item.id,
    ...(item.data() as Partial<Lead>),
    brandId,
    campaignId: String(item.data().campaignId ?? ""),
    fullName: String(item.data().fullName ?? ""),
  });
}

export async function findLeadByPublicId(brandId: string, publicId: string) {
  if (!publicId) return null;
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("brandId", "==", brandId)
    .where("linkedinPublicId", "==", publicId)
    .limit(1)
    .get();
  const item = snapshot.docs[0];
  if (!item) return null;
  return hydrateLead({
    id: item.id,
    ...(item.data() as Partial<Lead>),
    brandId,
    campaignId: String(item.data().campaignId ?? ""),
    fullName: String(item.data().fullName ?? ""),
  });
}

export async function findAwaitingLeads(brandId: string, awaiting: "connection" | "inmail") {
  const snapshot = await requireFirebaseDb()
    .collection("leads")
    .where("brandId", "==", brandId)
    .where("awaiting", "==", awaiting)
    .get();
  return snapshot.docs.map((item) =>
    hydrateLead({
      id: item.id,
      ...(item.data() as Partial<Lead>),
      brandId,
      campaignId: String(item.data().campaignId ?? ""),
      fullName: String(item.data().fullName ?? ""),
    }),
  );
}

function initialSchedule(flow: CampaignFlowStep[], active: boolean) {
  const first = firstOpenStep(flow);
  if (!first || !active) {
    return { nextStepId: first?.id ?? "", nextStepAt: undefined as Date | undefined };
  }
  return { nextStepId: first.id, nextStepAt: scheduleAt(first) };
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
  schedule?: boolean;
  deferAvatar?: boolean;
}) {
  const campaign = await fetchCampaign(input.campaignId);
  if (!campaign || campaign.brandId !== input.brandId) {
    throw new Error("not-found");
  }
  const addedAt = new Date();
  const linkedinUrl = normalizeLinkedInUrl(input.linkedinUrl) || input.linkedinUrl.trim();
  const schedule = initialSchedule(
    campaign.flow,
    input.schedule ?? isCampaignRunning(campaign.status),
  );
  const db = requireFirebaseDb();
  const ref = db.collection("leads").doc();
  const lead = hydrateLead({
    id: ref.id,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName.trim(),
    linkedinUrl,
    linkedinPublicId: linkedInPublicId(linkedinUrl),
    unipileProviderId: input.unipileProviderId ?? "",
    avatarUrl: input.pictureUrl?.trim() ?? "",
    status: "queued",
    lastMessageSentAt: addedAt,
    company: input.company?.trim() ?? "",
    position: input.position?.trim() ?? "",
    stage: "connection_request",
    email: input.email?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    history: [{ kind: "added", at: addedAt }],
    nextStepId: schedule.nextStepId,
    nextStepAt: schedule.nextStepAt,
  });
  await ref.create(leadPayload(lead));
  if (!input.deferAvatar) {
    await persistRemoteLeadAvatar(lead);
  }
  return lead;
}

async function persistRemoteLeadAvatar(lead: Lead) {
  if (!isRemoteAvatarUrl(lead.avatarUrl ?? "")) return lead;
  const stored = await ingestLeadAvatar({ leadId: lead.id, remoteUrl: lead.avatarUrl });
  if (!stored) return lead;
  lead.avatarUrl = stored;
  lead.avatarChecked = true;
  await requireFirebaseDb().collection("leads").doc(lead.id).update({
    avatarUrl: stored,
    avatarChecked: true,
  });
  return lead;
}

export async function createLeads(
  brandId: string,
  campaignId: string,
  rows: Array<{
    fullName: string;
    linkedinUrl: string;
    company?: string;
    position?: string;
    email?: string;
    phone?: string;
    unipileProviderId?: string;
    pictureUrl?: string;
  }>,
) {
  const created: Lead[] = [];
  for (const row of rows) {
    created.push(
      await createLead({
        brandId,
        campaignId,
        ...row,
        deferAvatar: true,
      }),
    );
  }
  await Promise.all(created.map((lead) => persistRemoteLeadAvatar(lead)));
  return created;
}

export async function copyCampaignLeads(
  brandId: string,
  sourceCampaignId: string,
  targetCampaignId: string,
) {
  const source = await fetchLeadsByCampaign(sourceCampaignId);
  const created: Lead[] = [];
  for (const lead of source) {
    const next = await createLead({
      brandId,
      campaignId: targetCampaignId,
      fullName: lead.fullName,
      linkedinUrl: lead.linkedinUrl,
      company: lead.company,
      position: lead.position,
      email: lead.email,
      phone: lead.phone,
      unipileProviderId: lead.unipileProviderId,
      pictureUrl: isRemoteAvatarUrl(lead.avatarUrl ?? "") ? lead.avatarUrl : "",
    });
    if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "") && (await copyLeadAvatar(lead.id, next.id))) {
      next.avatarUrl = leadAvatarUrl(next.id);
      next.avatarChecked = true;
      await requireFirebaseDb().collection("leads").doc(next.id).update({
        avatarUrl: next.avatarUrl,
        avatarChecked: true,
      });
    }
    created.push(next);
  }
  return created;
}

export async function saveLead(lead: Lead) {
  await requireFirebaseDb().collection("leads").doc(lead.id).set(leadPayload(lead), { merge: true });
  return lead;
}

export async function fetchMessages(brandId: string): Promise<OutreachMessage[]> {
  const snapshot = await requireFirebaseDb()
    .collection("messages")
    .where("brandId", "==", brandId)
    .get();
  return snapshot.docs
    .map((item) =>
      hydrateMessage({
        id: item.id,
        ...(item.data() as Partial<OutreachMessage>),
      }),
    )
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

export async function createMessage(input: Omit<OutreachMessage, "id">) {
  const db = requireFirebaseDb();
  const ref = db.collection("messages").doc();
  const message = hydrateMessage({ id: ref.id, ...input });
  await ref.create({
    brandId: message.brandId,
    campaignId: message.campaignId,
    campaignName: message.campaignName,
    leadId: message.leadId,
    leadName: message.leadName,
    direction: message.direction,
    body: message.body,
    sentAt: Timestamp.fromDate(message.sentAt),
    unipileMessageId: message.unipileMessageId ?? "",
  });
  return message;
}

function statDocId(brandId: string, date: string, campaignId?: string) {
  return campaignId ? `${brandId}_${campaignId}_${date}` : `${brandId}_${date}`;
}

export async function incrementDailyStat(
  brandId: string,
  patch: {
    sent?: number;
    replied?: number;
    views?: number;
    invites?: number;
    messages?: number;
    accepted?: number;
    inmails?: number;
  },
  campaignId?: string,
) {
  const db = requireFirebaseDb();
  const date = toDateKey(new Date());
  const write = async (id: string, extra: Record<string, string>) => {
    const ref = db.collection("daily_stats").doc(id);
    const snapshot = await ref.get();
    const current = snapshot.data() ?? {};
    await ref.set(
      {
        brandId,
        date,
        ...extra,
        sentCount: Number(current.sentCount ?? 0) + (patch.sent ?? 0),
        repliedCount: Number(current.repliedCount ?? 0) + (patch.replied ?? 0),
        views: Number(current.views ?? 0) + (patch.views ?? 0),
        invites: Number(current.invites ?? 0) + (patch.invites ?? 0),
        messages: Number(current.messages ?? 0) + (patch.messages ?? 0),
        accepted: Number(current.accepted ?? 0) + (patch.accepted ?? 0),
        inmails: Number(current.inmails ?? 0) + (patch.inmails ?? 0),
      },
      { merge: true },
    );
  };
  await write(statDocId(brandId, date), {});
  if (campaignId) {
    await write(statDocId(brandId, date, campaignId), { campaignId });
  }
}

export async function fetchDailyStats(brandId: string, campaignId?: string): Promise<DailyStat[]> {
  const snapshot = await requireFirebaseDb()
    .collection("daily_stats")
    .where("brandId", "==", brandId)
    .get();
  return snapshot.docs
    .filter((item) => {
      const data = item.data();
      const stored = String(data.campaignId ?? "");
      return campaignId ? stored === campaignId : !stored;
    })
    .map((item) => {
      const data = item.data();
      return {
        date: String(data.date ?? ""),
        sentCount: Number(data.sentCount ?? 0),
        repliedCount: Number(data.repliedCount ?? 0),
        views: Number(data.views ?? 0),
        invites: Number(data.invites ?? 0),
        messages: Number(data.messages ?? 0),
        accepted: Number(data.accepted ?? 0),
        inmails: Number(data.inmails ?? 0),
      };
    })
    .filter((stat) => stat.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function todayPacingUsage(brandId: string) {
  const stats = await fetchDailyStats(brandId);
  const today = toDateKey(new Date());
  const row = stats.find((stat) => stat.date === today);
  return {
    views: row?.views ?? 0,
    invites: row?.invites ?? 0,
    messages: row?.messages ?? 0,
    inmails: row?.inmails ?? 0,
  };
}

export function brandCardStatsFromCampaigns(campaigns: Campaign[]) {
  const sent = campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0);
  const replied = campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0);
  return {
    activeCampaigns: campaigns.filter(
      (campaign) => isCampaignRunning(campaign.status),
    ).length,
    successRate: sent > 0 ? (replied / sent) * 100 : 0,
  };
}

export async function fetchBrandSummaries() {
  const snapshot = await requireFirebaseDb().collection("campaigns").get();
  const byBrand = new Map<string, Campaign[]>();
  for (const item of snapshot.docs) {
    const data = item.data();
    const brandId = String(data.brandId ?? "");
    if (!brandId) continue;
    const campaign = hydrateCampaign({
      id: item.id,
      ...(data as Partial<Campaign>),
      brandId,
      name: String(data.name ?? ""),
    });
    const list = byBrand.get(brandId) ?? [];
    list.push(campaign);
    byBrand.set(brandId, list);
  }
  const summaries: Record<string, { activeCampaigns: number; successRate: number }> = {};
  for (const [brandId, campaigns] of byBrand) {
    summaries[brandId] = brandCardStatsFromCampaigns(campaigns);
  }
  return summaries;
}

export async function deleteOutreachForBrand(db: Firestore, brandId: string) {
  const collections = ["campaigns", "leads", "messages", "daily_stats"] as const;
  for (const name of collections) {
    const snapshot = await db.collection(name).where("brandId", "==", brandId).get();
    if (name === "leads") {
      await Promise.all(snapshot.docs.map((item) => deleteLeadAvatar(item.id)));
    }
    const batchSize = 400;
    for (let index = 0; index < snapshot.docs.length; index += batchSize) {
      const batch = db.batch();
      snapshot.docs.slice(index, index + batchSize).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
}

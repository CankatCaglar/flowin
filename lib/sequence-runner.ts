import "server-only";
import { campaignStepCopy } from "@/lib/campaign-flow";
import { fetchBrand } from "@/lib/data";
import { Timestamp } from "firebase-admin/firestore";
import { requireFirebaseDb } from "@/lib/firebase";
import { interpolateTemplate, splitPersonName } from "@/lib/linkedin-profile";
import {
  createMessage,
  fetchCampaign,
  fetchCampaigns,
  fetchLead,
  fetchLeads,
  incrementCampaignCounters,
  incrementDailyStat,
  findMessageByUnipileId,
  saveLead,
  todayPacingUsage,
} from "@/lib/outreach-data";
import { historyHas, isLeadFlowTerminal, SEND_EVENT_KINDS } from "@/lib/leads";
import { isCampaignRunning } from "@/lib/campaign-status";
import { effectivePacing, isQuietHours, normalizeSchedule } from "@/lib/pacing";
import {
  earliestStepAt,
  findStep,
  firstBranchStep,
  firstOpenStep,
  flowStepQuotaKind,
  isRunnable,
  isStepDueNow,
  messageIndexOnAcceptedPath,
  nextStepInLane,
  readyQuotaKind,
  repairLeadFlowCursor,
  scheduleAt,
  stageAfterMessageIndex,
  tomorrowMorning,
} from "@/lib/sequence";
import {
  companyFromUnipileProfile,
  getUnipileProfile,
  isAlreadyConnectedInviteError,
  isFirstDegree,
  isInsufficientCreditsError,
  isPendingInviteError,
  isRetryableUnipileError,
  isTransientFailReason,
  reportProfileVisit,
  sendUnipileInvitation,
    startUnipileChat,
    unipileSentIds,
    UnipileError,
  unipilePictureUrl,
  type UnipileProfile,
} from "@/lib/unipile";
import { ingestLeadAvatar, isStoredLeadAvatarUrl } from "@/lib/brand-avatar";
import { findActiveOccupant } from "@/lib/lead-identity";
import type { Brand, Campaign, CampaignFlowStep, Lead } from "@/types";

const MIN_STEP_GAP_MS = 20 * 60 * 1000;

function lastHistoryAt(lead: Lead) {
  const last = lead.history[lead.history.length - 1];
  return last?.at;
}

function templateValues(lead: Lead) {
  const names = splitPersonName(lead.fullName);
  return {
    firstName: names.firstName,
    lastName: names.lastName,
    company: lead.company,
    position: lead.position,
  };
}

function stepCopy(step: CampaignFlowStep, lead: Lead) {
  return interpolateTemplate(campaignStepCopy(step, "tr"), templateValues(lead));
}

async function applyProfilePhoto(lead: Lead, profile: unknown) {
  const company = companyFromUnipileProfile((profile ?? {}) as UnipileProfile);
  if (company && !lead.company.trim()) lead.company = company;
  if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) {
    lead.avatarChecked = true;
    return;
  }
  const picture = unipilePictureUrl(profile);
  if (!picture) return;
  try {
    const stored = await ingestLeadAvatar({ leadId: lead.id, remoteUrl: picture });
    lead.avatarUrl = stored || picture;
    lead.avatarChecked = Boolean(stored);
  } catch {
    lead.avatarUrl = picture;
  }
}

async function resolveProviderId(accountId: string, lead: Lead) {
  if (lead.unipileProviderId) return lead.unipileProviderId;
  const identifier = lead.linkedinPublicId || lead.linkedinUrl;
  if (!identifier) throw new UnipileError("missing-linkedin-id", 400);
  const profile = await getUnipileProfile(accountId, identifier);
  lead.unipileProviderId = profile.provider_id ?? "";
  if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
  await applyProfilePhoto(lead, profile);
  if (!lead.unipileProviderId) throw new UnipileError("profile-provider-missing", 400);
  return lead.unipileProviderId;
}

async function applyUsage(
  brandId: string,
  campaignId: string,
  kind: "views" | "invites" | "messages" | "inmails",
  stepId?: string,
) {
  const sent = kind === "invites" || kind === "messages" || kind === "inmails" ? 1 : 0;
  await incrementDailyStat(
    brandId,
    {
      sent,
      views: kind === "views" ? 1 : 0,
      invites: kind === "invites" ? 1 : 0,
      messages: kind === "messages" ? 1 : 0,
      inmails: kind === "inmails" ? 1 : 0,
    },
    campaignId,
  );
  if (sent) {
    await incrementCampaignCounters(campaignId, { sent: 1, stepId });
  } else if (stepId) {
    await incrementCampaignCounters(campaignId, { stepId });
  }
}

function appendHistory(lead: Lead, kind: Lead["history"][number]["kind"]) {
  const at = new Date();
  lead.history = [...lead.history, { kind, at }];
  if (SEND_EVENT_KINDS.includes(kind)) lead.lastMessageSentAt = at;
}

function scheduleNext(
  lead: Lead,
  campaign: Campaign,
  current: CampaignFlowStep,
  branch = current.branch || lead.currentBranch,
  schedule = normalizeSchedule(undefined),
) {
  const next = nextStepInLane(campaign.flow, current.id, branch);
  if (!next) {
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
    if (lead.status !== "replied" && lead.status !== "failed") {
      lead.status = "flow_completed";
      lead.stage = "flow_completed";
    }
    return;
  }
  lead.nextStepId = next.id;
  lead.nextStepAt = scheduleAt(next, new Date(), schedule);
}

export async function markLeadAccepted(lead: Lead, campaign: Campaign) {
  if (lead.status === "replied" || lead.status === "flow_completed") {
    return lead;
  }
  if (historyHas(lead, "accepted")) {
    lead.currentBranch = "accepted";
    lead.awaiting = "";
    if (lead.status === "failed") lead.status = "queued";
    return saveLead(lead);
  }
  appendHistory(lead, "accepted");
  lead.currentBranch = "accepted";
  lead.awaiting = "";
  lead.status = "queued";
  lead.stage = "accepted";
  lead.failReason = "";
  const next = firstBranchStep(campaign.flow, "accepted");
  if (next) {
    const brand = await fetchBrand(lead.brandId);
    lead.nextStepId = next.id;
    lead.nextStepAt = scheduleAt(next, new Date(), normalizeSchedule(brand?.schedule));
  } else {
    lead.status = "flow_completed";
    lead.stage = "flow_completed";
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
  }
  await incrementDailyStat(lead.brandId, { accepted: 1 }, campaign.id);
  return saveLead(lead);
}

async function storeInboundReply(
  lead: Lead,
  campaign: Campaign,
  body: string,
  ids?: { unipileMessageId?: string; skipInbox?: boolean },
) {
  if (ids?.skipInbox) return;
  const text = body.trim();
  if (!text) return;
  const remoteId = ids?.unipileMessageId?.trim() ?? "";
  if (remoteId && (await findMessageByUnipileId(lead.brandId, remoteId))) return;
  await createMessage({
    brandId: lead.brandId,
    campaignId: lead.campaignId,
    campaignName: campaign.name,
    leadId: lead.id,
    leadName: lead.fullName,
    direction: "inbound",
    body: text,
    sentAt: new Date(),
    unipileMessageId: remoteId,
  });
}

export async function markLeadReplied(
  lead: Lead,
  campaign: Campaign,
  body: string,
  ids?: { unipileMessageId?: string; unipileChatId?: string; skipInbox?: boolean },
) {
  if (ids?.unipileChatId) lead.unipileChatId = ids.unipileChatId || lead.unipileChatId;
  if (lead.status === "replied") {
    await storeInboundReply(lead, campaign, body, ids);
    return saveLead(lead);
  }
  if (lead.awaiting === "inmail") {
    return queueInmailReply(lead, campaign, body, ids);
  }
  const at = new Date();
  appendHistory(lead, "replied");
  lead.status = "replied";
  lead.awaiting = "";
  lead.nextStepId = "";
  lead.nextStepAt = undefined;
  lead.firstReplyReceivedAt = at;
  await storeInboundReply(lead, campaign, body, ids);
  await incrementDailyStat(lead.brandId, { replied: 1 }, lead.campaignId);
  await incrementCampaignCounters(lead.campaignId, { replied: 1 });
  const saved = await saveLead(lead);
  const { notifyIfCampaignEmpty } = await import("@/lib/notifications");
  await notifyIfCampaignEmpty(lead.campaignId);
  return saved;
}

async function queueInmailReply(
  lead: Lead,
  campaign: Campaign,
  body: string,
  ids?: { unipileMessageId?: string; unipileChatId?: string; skipInbox?: boolean },
) {
  const at = new Date();
  if (!historyHas(lead, "replied")) appendHistory(lead, "replied");
  lead.awaiting = "";
  lead.currentBranch = "inmail_accepted";
  lead.status = "queued";
  lead.firstReplyReceivedAt = lead.firstReplyReceivedAt ?? at;
  const next = firstBranchStep(campaign.flow, "inmail_accepted");
  if (next) {
    const brand = await fetchBrand(lead.brandId);
    lead.nextStepId = next.id;
    lead.nextStepAt = scheduleAt(next, new Date(), normalizeSchedule(brand?.schedule));
  } else {
    lead.status = "replied";
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
  }
  if (!ids?.skipInbox) {
    await createMessage({
      brandId: lead.brandId,
      campaignId: lead.campaignId,
      campaignName: campaign.name,
      leadId: lead.id,
      leadName: lead.fullName,
      direction: "inbound",
      body,
      sentAt: at,
      unipileMessageId: ids?.unipileMessageId ?? "",
    });
  }
  await incrementDailyStat(lead.brandId, { replied: 1 }, lead.campaignId);
  await incrementCampaignCounters(lead.campaignId, { replied: 1 });
  return saveLead(lead);
}

async function waitForConnection(
  lead: Lead,
  campaign: Campaign,
  schedule = normalizeSchedule(undefined),
) {
  if (!historyHasConnection(lead)) appendHistory(lead, "connection_sent");
  lead.status = "waiting_reply";
  lead.stage = "connection_request";
  lead.awaiting = "connection";
  lead.failReason = "";
  const timeout = firstBranchStep(campaign.flow, "no_response");
  lead.nextStepId = timeout?.id ?? "";
  lead.nextStepAt = timeout ? scheduleAt(timeout, new Date(), schedule) : undefined;
  return saveLead(lead);
}

function historyHasConnection(lead: Lead) {
  return lead.history.some((event) => event.kind === "connection_sent");
}

async function executeStep(
  lead: Lead,
  campaign: Campaign,
  step: CampaignFlowStep,
  accountId: string,
  schedule = normalizeSchedule(undefined),
) {
  if (historyHas(lead, "accepted")) {
    lead.currentBranch = "accepted";
  } else if (step.branch) {
    lead.currentBranch = step.branch;
  }

  if (step.kind === "profile_view" || step.kind === "connection_check") {
    const last = lead.history[lead.history.length - 1];
    const repeatView = last?.kind === "profile_viewed" && lead.nextStepId === step.id;
    if (!repeatView) {
      const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
      const profile = await getUnipileProfile(accountId, identifier);
      lead.unipileProviderId = profile.provider_id || lead.unipileProviderId;
      if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
      await applyProfilePhoto(lead, profile);
      if (profile.notify_visit_token) {
        try {
          await reportProfileVisit(accountId, profile.notify_visit_token);
        } catch (error) {
          console.error("[unipile] profile visit skipped:", error instanceof Error ? error.message : error);
        }
      }
      const alreadyOnAccepted =
        lead.currentBranch === "accepted" || lead.currentBranch === "inmail_accepted";
      if (isFirstDegree(profile) && !alreadyOnAccepted && lead.awaiting !== "inmail") {
        await applyUsage(lead.brandId, campaign.id, "views", step.id);
        appendHistory(lead, "profile_viewed");
        lead.failReason = "";
        return markLeadAccepted(lead, campaign);
      }
      appendHistory(lead, "profile_viewed");
      if (!lead.currentBranch && !lead.awaiting) {
        lead.stage = "profile_viewed";
      }
      await applyUsage(lead.brandId, campaign.id, "views", step.id);
    }
    if (lead.awaiting === "connection" && !lead.currentBranch) {
      lead.currentBranch = "no_response";
      const next = firstBranchStep(campaign.flow, "no_response");
      if (next && next.id !== step.id) {
        lead.nextStepId = next.id;
        lead.nextStepAt = scheduleAt(next, new Date(), schedule);
      } else {
        scheduleNext(lead, campaign, step, "no_response", schedule);
      }
    } else {
      scheduleNext(lead, campaign, step, lead.currentBranch, schedule);
    }
    return saveLead(lead);
  }

  const providerId = await resolveProviderId(accountId, lead);
  const body = step.kind === "connection" ? "" : stepCopy(step, lead);

  if (step.kind === "connection") {
    try {
      const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
      if (identifier) {
        try {
          const profile = await getUnipileProfile(accountId, identifier);
          lead.unipileProviderId = profile.provider_id || lead.unipileProviderId;
          if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
          await applyProfilePhoto(lead, profile);
          if (isFirstDegree(profile)) {
            return markLeadAccepted(lead, campaign);
          }
        } catch (error) {
          if (!isRetryableUnipileError(error)) throw error;
        }
      }
      await sendUnipileInvitation(accountId, providerId);
    } catch (error) {
      if (isAlreadyConnectedInviteError(error)) {
        return markLeadAccepted(lead, campaign);
      }
      if (isPendingInviteError(error)) {
        return waitForConnection(lead, campaign, schedule);
      }
      throw error;
    }
    await applyUsage(lead.brandId, campaign.id, "invites", step.id);
    return waitForConnection(lead, campaign, schedule);
  }

  if (step.kind === "message" || step.kind === "inmail") {
    const chat = await startUnipileChat({
      accountId,
      attendeeId: providerId,
      text: body,
      inmail: step.kind === "inmail",
    });
    const ids = unipileSentIds(chat);
    lead.unipileChatId = ids.chatId || lead.unipileChatId;
    if (step.kind === "inmail") {
      appendHistory(lead, "inmail_sent");
      lead.stage = "inmail";
      lead.awaiting = "inmail";
      lead.status = "waiting_reply";
      const timeout = firstBranchStep(campaign.flow, "inmail_no_response");
      lead.nextStepId = timeout?.id ?? "";
      lead.nextStepAt = timeout ? scheduleAt(timeout, new Date(), schedule) : undefined;
    } else {
      const index = messageIndexOnAcceptedPath(campaign.flow, step.id);
      const kind =
        index === 1 ? "message_2_sent" : index >= 2 ? "message_3_sent" : "message_1_sent";
      appendHistory(lead, kind);
      lead.stage = stageAfterMessageIndex(Math.max(index, 0));
      lead.status = "waiting_reply";
      if (lead.currentBranch === "inmail_accepted") {
        lead.status = "flow_completed";
        lead.stage = "flow_completed";
        lead.nextStepId = "";
        lead.nextStepAt = undefined;
      } else {
        scheduleNext(lead, campaign, step, lead.currentBranch, schedule);
      }
    }
    await applyUsage(
      lead.brandId,
      campaign.id,
      step.kind === "inmail" ? "inmails" : "messages",
      step.id,
    );
    await createMessage({
      brandId: lead.brandId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      leadId: lead.id,
      leadName: lead.fullName,
      direction: "outbound",
      body,
      sentAt: new Date(),
      unipileMessageId: ids.messageId,
    });
    return saveLead(lead);
  }

  scheduleNext(lead, campaign, step, lead.currentBranch, schedule);
  return saveLead(lead);
}

export async function runLeadStep(
  input: Lead,
  occupancy?: { leads: Lead[]; campaigns: Campaign[] },
) {
  const fresh = await fetchLead(input.id);
  const lead = fresh ?? input;
  if (!isRunnable(lead)) return { skipped: true as const };
  const recent = lastHistoryAt(lead);
  if (recent && Date.now() - recent.getTime() < MIN_STEP_GAP_MS) {
    return { deferred: "cooldown" as const };
  }
  const [brand, campaign] = await Promise.all([
    fetchBrand(lead.brandId),
    fetchCampaign(lead.campaignId),
  ]);
  if (!brand || !campaign) return { skipped: true as const };
  if (!isCampaignRunning(campaign.status)) {
    return { skipped: true as const };
  }
  const schedule = normalizeSchedule(brand.schedule);
  const occupied = occupancy ?? {
    leads: await fetchLeads(lead.brandId),
    campaigns: await fetchCampaigns(lead.brandId),
  };
  const owner = findActiveOccupant(occupied.leads, occupied.campaigns, lead);
  if (owner && owner.lead.id !== lead.id) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: "duplicate-active" as const };
  }
  if (brand.outreachPaused || brand.archived || brand.testMode) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: brand.testMode ? "test-mode" : "outreach-paused" as const };
  }
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: "unipile-disconnected" as const };
  }

  if (isQuietHours(new Date(), schedule)) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: "quiet-hours" as const };
  }

  repairLeadFlowCursor(lead, campaign.flow, schedule);
  const step = findStep(campaign.flow, lead.nextStepId);
  if (!step) {
    if (lead.nextStepId) {
      lead.nextStepId = "";
      await saveLead(lead);
    }
    return { skipped: true as const };
  }
  const earliest = earliestStepAt(lead, step, schedule);
  if (!isStepDueNow(earliest, schedule)) {
    if (!lead.nextStepAt || lead.nextStepAt.getTime() < earliest.getTime()) {
      lead.nextStepAt = earliest;
      await saveLead(lead);
    }
    return { deferred: "not-due" as const };
  }

  const caps = effectivePacing(brand);
  const usage = await todayPacingUsage(brand.id);
  const kind = flowStepQuotaKind(step);
  if (
    (kind === "views" && usage.views >= caps.dailyViews) ||
    (kind === "invites" && usage.invites >= caps.dailyInvites) ||
    (kind === "messages" && usage.messages >= caps.dailyMessages) ||
    (kind === "inmails" && usage.inmails >= caps.dailyInmails)
  ) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: "pacing" as const, brand, kind };
  }

  try {
    await executeStep(lead, campaign, step, brand.unipileAccountId, schedule);
    return { ok: true as const, step: step.kind, kind, lead, campaign };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unipile";
    console.error("[sequence] step failed:", lead.id, step.kind, message);
    if (isInsufficientCreditsError(error)) {
      lead.failReason = message;
      lead.nextStepAt = tomorrowMorning(new Date(), schedule);
      await saveLead(lead);
      return { deferred: "credits" as const, brand, kind };
    }
    const retryable = isRetryableUnipileError(error);
    if (retryable) {
      const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const min = earliestStepAt(lead, step, schedule);
      lead.nextStepAt = retryAt.getTime() > min.getTime() ? retryAt : min;
      await saveLead(lead);
      return { deferred: "retry" as const };
    }
    appendHistory(lead, "failed");
    lead.status = "failed";
    lead.stage = "failed";
    lead.failReason = message;
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
    await saveLead(lead);
    return { failed: message, brand, campaign, lead };
  }
}

async function requeueTransientFailure(
  lead: Lead,
  campaign: Campaign,
  schedule = normalizeSchedule(undefined),
) {
  lead.failReason = "";
  repairLeadFlowCursor(lead, campaign.flow, schedule);
  if (historyHas(lead, "accepted")) {
    lead.currentBranch = "accepted";
    lead.awaiting = "";
    lead.status = "queued";
    const step = findStep(campaign.flow, lead.nextStepId);
    if (!step || step.branch !== "accepted") {
      lead.nextStepId = firstBranchStep(campaign.flow, "accepted")?.id ?? "";
    }
  } else if (historyHasConnection(lead)) {
    await waitForConnection(lead, campaign, schedule);
    return;
  } else {
    lead.status = "queued";
    lead.awaiting = "";
    if (!lead.nextStepId) {
      const invite = campaign.flow.find((step) => step.kind === "connection" && !step.branch);
      lead.nextStepId = historyHas(lead, "profile_viewed")
        ? invite?.id ?? firstOpenStep(campaign.flow)?.id ?? ""
        : firstOpenStep(campaign.flow)?.id ?? "";
    }
  }
  const step = findStep(campaign.flow, lead.nextStepId);
  lead.nextStepAt = step ? earliestStepAt(lead, step, schedule) : tomorrowMorning(new Date(), schedule);
  await saveLead(lead);
}

async function recoverFailedInvite(lead: Lead) {
  const [brand, campaign] = await Promise.all([fetchBrand(lead.brandId), fetchCampaign(lead.campaignId)]);
  if (!brand || !campaign || !isCampaignRunning(campaign.status)) return;
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) return;
  if (isAlreadyConnectedInviteError(lead.failReason)) {
    await markLeadAccepted(lead, campaign);
    return;
  }
  if (isPendingInviteError(lead.failReason)) {
    await waitForConnection(lead, campaign, normalizeSchedule(brand.schedule));
    return;
  }
  const schedule = normalizeSchedule(brand.schedule);
  if (isInsufficientCreditsError(lead.failReason)) {
    lead.status = "queued";
    lead.failReason = lead.failReason;
    repairLeadFlowCursor(lead, campaign.flow, schedule);
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return;
  }
  if (isTransientFailReason(lead.failReason ?? "")) {
    await requeueTransientFailure(lead, campaign, schedule);
  }
}

export async function recoverFailedInvites(brandId?: string) {
  const { fetchFailedLeads } = await import("@/lib/outreach-data");
  const recoverable = (await fetchFailedLeads()).filter((lead) => {
    if (brandId && lead.brandId !== brandId) return false;
    return (
      isPendingInviteError(lead.failReason) ||
      isAlreadyConnectedInviteError(lead.failReason) ||
      isTransientFailReason(lead.failReason ?? "")
    );
  });
  for (const lead of recoverable) {
    try {
      await recoverFailedInvite(lead);
    } catch (error) {
      console.error(
        "[sequence] invite recover failed:",
        lead.id,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return recoverable.length;
}

type QuotaKind = "views" | "invites" | "messages" | "inmails";

type BrandRuntime = {
  occupancy: { leads: Lead[]; campaigns: Campaign[] };
  remaining: Record<QuotaKind, number>;
  schedule: ReturnType<typeof normalizeSchedule>;
  brand?: Brand;
};

const QUOTA_KINDS: QuotaKind[] = ["views", "invites", "messages", "inmails"];
const LOCK_MS = 4 * 60 * 1000;

async function acquireSequenceLock(id: string) {
  const ref = requireFirebaseDb().collection("_locks").doc(`sequence:${id}`);
  try {
    await requireFirebaseDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const until = Number(snap.data()?.until ?? 0);
      if (until > Date.now()) throw new Error("locked");
      tx.set(ref, { until: Date.now() + LOCK_MS, at: Timestamp.now() });
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseSequenceLock(id: string) {
  await requireFirebaseDb()
    .collection("_locks")
    .doc(`sequence:${id}`)
    .delete()
    .catch(() => undefined);
}

export async function runDueSequence(limit = 80, brandId?: string) {
  await recoverFailedInvites(brandId);
  const { fetchRunnableLeads } = await import("@/lib/outreach-data");
  const pool = (await fetchRunnableLeads(brandId)).sort(
    (a, b) => (a.nextStepAt?.getTime() ?? 0) - (b.nextStepAt?.getTime() ?? 0),
  );
  const results = {
    processed: 0,
    ok: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
  };
  const runtimes = new Map<string, BrandRuntime>();
  const failures: Array<{ brand: Brand; lead: Lead; campaign: Campaign }> = [];
  const emptyCampaigns = new Set<string>();
  const capHits = new Map<string, { brand: Brand; kinds: Set<QuotaKind> }>();
  const markCap = (brand: Brand, kind?: QuotaKind | null) => {
    if (!kind) return;
    const row = capHits.get(brand.id) ?? { brand, kinds: new Set<QuotaKind>() };
    row.kinds.add(kind);
    capHits.set(brand.id, row);
  };
  const runtimeFor = async (id: string) => {
    let runtime = runtimes.get(id);
    if (runtime) return runtime;
    const occupancy = {
      leads: await fetchLeads(id),
      campaigns: await fetchCampaigns(id),
    };
    const brand = await fetchBrand(id);
    const caps = brand
      ? effectivePacing(brand)
      : { dailyViews: 0, dailyInvites: 0, dailyMessages: 0, dailyInmails: 0 };
    const usage = await todayPacingUsage(id);
    runtime = {
      occupancy,
      remaining: {
        views: Math.max(0, caps.dailyViews - usage.views),
        invites: Math.max(0, caps.dailyInvites - usage.invites),
        messages: Math.max(0, caps.dailyMessages - usage.messages),
        inmails: Math.max(0, caps.dailyInmails - usage.inmails),
      },
      schedule: normalizeSchedule(brand?.schedule),
      brand: brand ?? undefined,
    };
    runtimes.set(id, runtime);
    return runtime;
  };

  const readyKind = (lead: Lead, runtime: BrandRuntime) => {
    const campaign = runtime.occupancy.campaigns.find((item) => item.id === lead.campaignId);
    if (!campaign || !isCampaignRunning(campaign.status)) return null;
    return readyQuotaKind(lead, campaign.flow, runtime.schedule);
  };

  const brandIds = [...new Set(pool.map((lead) => lead.brandId))];
  const locked: string[] = [];
  for (const id of brandIds) {
    if (await acquireSequenceLock(id)) locked.push(id);
  }
  const lockedSet = new Set(locked);

  try {
    const byKind = new Map<QuotaKind, Lead[]>();
    for (const kind of QUOTA_KINDS) byKind.set(kind, []);
    for (const lead of pool) {
      if (!lockedSet.has(lead.brandId)) continue;
      const runtime = await runtimeFor(lead.brandId);
      if (isQuietHours(new Date(), runtime.schedule)) continue;
      const kind = readyKind(lead, runtime);
      if (!kind || runtime.remaining[kind] <= 0) continue;
      byKind.get(kind)?.push(lead);
    }

    const queue: Lead[] = [];
    for (const kind of QUOTA_KINDS) {
      const runtimeSlots = new Map<string, number>();
      for (const lead of byKind.get(kind) ?? []) {
        const runtime = await runtimeFor(lead.brandId);
        const left = runtimeSlots.get(lead.brandId) ?? runtime.remaining[kind];
        if (left <= 0) continue;
        runtimeSlots.set(lead.brandId, left - 1);
        queue.push(lead);
      }
    }

    for (const lead of queue) {
      if (results.ok >= limit) break;
      const runtime = await runtimeFor(lead.brandId);
      const kind = readyKind(lead, runtime);
      if (!kind || runtime.remaining[kind] <= 0) continue;
      results.processed += 1;
      let result: Awaited<ReturnType<typeof runLeadStep>>;
      try {
        result = await runLeadStep(lead, runtime.occupancy);
      } catch (error) {
        results.skipped += 1;
        console.error(
          "[sequence] lead crashed:",
          lead.id,
          error instanceof Error ? error.message : error,
        );
        continue;
      }
      if ("ok" in result && result.ok) {
        results.ok += 1;
        const used = result.kind ?? kind;
        if (used) {
          runtime.remaining[used] = Math.max(0, runtime.remaining[used] - 1);
          if (runtime.remaining[used] === 0 && runtime.brand) markCap(runtime.brand, used);
        }
        if (isLeadFlowTerminal(result.lead)) emptyCampaigns.add(result.campaign.id);
      } else if ("deferred" in result) {
        results.deferred += 1;
        if (result.deferred === "pacing") {
          const hit = ("kind" in result ? result.kind : undefined) ?? kind;
          if (hit) runtime.remaining[hit] = 0;
          if ("brand" in result && result.brand) markCap(result.brand, hit);
        }
      } else if ("failed" in result) {
        results.failed += 1;
        if ("brand" in result && result.brand && "campaign" in result && result.campaign) {
          failures.push({ brand: result.brand, lead: result.lead, campaign: result.campaign });
          emptyCampaigns.add(result.campaign.id);
        }
      } else results.skipped += 1;
    }
  } finally {
    for (const id of locked) await releaseSequenceLock(id);
  }

  if (failures.length) {
    const { notifySequenceFailures } = await import("@/lib/notifications");
    await notifySequenceFailures(failures);
  }
  if (capHits.size) {
    const { notifyDailyCap } = await import("@/lib/notifications");
    for (const { brand, kinds } of capHits.values()) {
      for (const kind of kinds) await notifyDailyCap(brand, kind);
    }
  }
  if (emptyCampaigns.size) {
    const { notifyIfCampaignEmpty } = await import("@/lib/notifications");
    for (const campaignId of emptyCampaigns) await notifyIfCampaignEmpty(campaignId);
  }
  return results;
}

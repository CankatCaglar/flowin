import "server-only";
import { flowStepBody } from "@/lib/campaign-flow";
import { fetchBrand } from "@/lib/data";
import { interpolateTemplate, splitPersonName } from "@/lib/linkedin-profile";
import {
  createMessage,
  fetchCampaign,
  fetchCampaigns,
  fetchLeads,
  incrementCampaignCounters,
  incrementDailyStat,
  saveLead,
  todayPacingUsage,
} from "@/lib/outreach-data";
import { historyHas, SEND_EVENT_KINDS } from "@/lib/leads";
import { isCampaignRunning } from "@/lib/campaign-status";
import { isQuietHours, istanbulDateKey, normalizePacing, normalizeSchedule, variedPacing, warmupPacing } from "@/lib/pacing";
import {
  findStep,
  firstBranchStep,
  isRunnable,
  messageIndexOnAcceptedPath,
  nextStepInLane,
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
  isPendingInviteError,
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
import type { Campaign, CampaignFlowStep, Lead } from "@/types";

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
  const raw = step.templateKey ? flowStepBody(step, "tr") : step.body || flowStepBody(step, "tr");
  return interpolateTemplate(raw, templateValues(lead));
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
  lead.stage = "message_1";
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

export async function markLeadReplied(
  lead: Lead,
  campaign: Campaign,
  body: string,
  ids?: { unipileMessageId?: string; unipileChatId?: string; skipInbox?: boolean },
) {
  if (ids?.unipileChatId) lead.unipileChatId = ids.unipileChatId || lead.unipileChatId;
  if (lead.status === "replied") return lead;
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
      const alreadyAccepted =
        lead.currentBranch === "accepted" || historyHas(lead, "accepted");
      if (isFirstDegree(profile) && !alreadyAccepted) {
        await applyUsage(lead.brandId, campaign.id, "views", step.id);
        appendHistory(lead, "profile_viewed");
        lead.failReason = "";
        await saveLead(lead);
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
    const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
    const profile = await getUnipileProfile(accountId, identifier);
    if (isFirstDegree(profile)) {
      return markLeadAccepted(lead, campaign);
    }
    try {
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
  lead: Lead,
  occupancy?: { leads: Lead[]; campaigns: Campaign[] },
) {
  if (!isRunnable(lead)) return { skipped: true as const };
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

  repairLeadFlowCursor(lead, campaign.flow);
  const step = findStep(campaign.flow, lead.nextStepId);
  if (!step) {
    if (lead.nextStepId) {
      lead.nextStepId = "";
      await saveLead(lead);
    }
    return { skipped: true as const };
  }

  const caps = variedPacing(
    warmupPacing(normalizePacing(brand.pacing), campaign.startDate),
    istanbulDateKey(),
    brand.id,
  );
  const usage = await todayPacingUsage(brand.id);
  const needsView = step.kind === "profile_view" || step.kind === "connection_check";
  const needsInvite = step.kind === "connection";
  const needsMessage = step.kind === "message";
  const needsInmail = step.kind === "inmail";
  if (
    (needsView && usage.views >= caps.dailyViews) ||
    (needsInvite && usage.invites >= caps.dailyInvites) ||
    (needsMessage && usage.messages >= caps.dailyMessages) ||
    (needsInmail && usage.inmails >= caps.dailyInmails)
  ) {
    lead.nextStepAt = tomorrowMorning(new Date(), schedule);
    await saveLead(lead);
    return { deferred: "pacing" as const };
  }

  try {
    await executeStep(lead, campaign, step, brand.unipileAccountId, schedule);
    return { ok: true as const, step: step.kind };
  } catch (error) {
    const retryable = error instanceof UnipileError && error.retryable;
    const message = error instanceof Error ? error.message : "unipile";
    console.error("[sequence] step failed:", lead.id, step.kind, message);
    if (retryable) {
      lead.nextStepAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await saveLead(lead);
      return { deferred: "retry" as const };
    }
    appendHistory(lead, "failed");
    lead.status = "failed";
    lead.failReason = message;
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
    await saveLead(lead);
    return { failed: message };
  }
}

async function recoverFailedInvite(lead: Lead) {
  const [brand, campaign] = await Promise.all([fetchBrand(lead.brandId), fetchCampaign(lead.campaignId)]);
  if (!brand || !campaign || !isCampaignRunning(campaign.status)) return;
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) return;
  const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
  if (!identifier) return;
  const profile = await getUnipileProfile(brand.unipileAccountId, identifier);
  if (isFirstDegree(profile) || isAlreadyConnectedInviteError(lead.failReason)) {
    await markLeadAccepted(lead, campaign);
    return;
  }
  if (isPendingInviteError(lead.failReason)) {
    await waitForConnection(lead, campaign, normalizeSchedule(brand.schedule));
  }
}

export async function recoverFailedInvites(brandId?: string) {
  const { fetchFailedLeads } = await import("@/lib/outreach-data");
  const recoverable = (await fetchFailedLeads()).filter((lead) => {
    if (brandId && lead.brandId !== brandId) return false;
    return isPendingInviteError(lead.failReason) || isAlreadyConnectedInviteError(lead.failReason);
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

export async function runDueSequence(limit = 3) {
  await recoverFailedInvites();
  const { fetchDueLeads } = await import("@/lib/outreach-data");
  const due = (await fetchDueLeads()).sort(
    (a, b) => (a.nextStepAt?.getTime() ?? 0) - (b.nextStepAt?.getTime() ?? 0),
  );
  const results = {
    processed: 0,
    ok: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
  };
  const occupancyByBrand = new Map<string, { leads: Lead[]; campaigns: Campaign[] }>();
  for (const lead of due.slice(0, limit)) {
    results.processed += 1;
    let occupancy = occupancyByBrand.get(lead.brandId);
    if (!occupancy) {
      occupancy = {
        leads: await fetchLeads(lead.brandId),
        campaigns: await fetchCampaigns(lead.brandId),
      };
      occupancyByBrand.set(lead.brandId, occupancy);
    }
    const result = await runLeadStep(lead, occupancy);
    if ("ok" in result && result.ok) results.ok += 1;
    else if ("deferred" in result) results.deferred += 1;
    else if ("failed" in result) results.failed += 1;
    else results.skipped += 1;
  }
  return results;
}

import "server-only";
import { flowStepBody } from "@/lib/campaign-flow";
import { fetchBrand } from "@/lib/data";
import { interpolateTemplate, splitPersonName } from "@/lib/linkedin-profile";
import {
  createMessage,
  fetchCampaign,
  incrementCampaignCounters,
  incrementDailyStat,
  saveLead,
  todayPacingUsage,
} from "@/lib/outreach-data";
import { isCampaignRunning } from "@/lib/campaign-status";
import { isQuietHours, normalizePacing } from "@/lib/pacing";
import {
  findStep,
  firstBranchStep,
  isRunnable,
  messageIndexOnAcceptedPath,
  nextStepInLane,
  scheduleAt,
  stageAfterMessageIndex,
  tomorrowMorning,
} from "@/lib/sequence";
import {
  getUnipileProfile,
  isFirstDegree,
  reportProfileVisit,
  sendUnipileInvitation,
  startUnipileChat,
  UnipileError,
} from "@/lib/unipile";
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
  return interpolateTemplate(flowStepBody(step, "en"), templateValues(lead));
}

async function resolveProviderId(accountId: string, lead: Lead) {
  if (lead.unipileProviderId) return lead.unipileProviderId;
  const identifier = lead.linkedinPublicId || lead.linkedinUrl;
  if (!identifier) throw new UnipileError("missing-linkedin-id", 400);
  const profile = await getUnipileProfile(accountId, identifier);
  lead.unipileProviderId = profile.provider_id ?? "";
  if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
  if (!lead.unipileProviderId) throw new UnipileError("profile-provider-missing", 400);
  return lead.unipileProviderId;
}

async function applyUsage(
  brandId: string,
  campaignId: string,
  kind: "views" | "invites" | "messages",
  stepId?: string,
) {
  const sent = kind === "invites" || kind === "messages" ? 1 : 0;
  await incrementDailyStat(
    brandId,
    {
      sent,
      views: kind === "views" ? 1 : 0,
      invites: kind === "invites" ? 1 : 0,
      messages: kind === "messages" ? 1 : 0,
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
  lead.history = [...lead.history, { kind, at: new Date() }];
  lead.lastMessageSentAt = new Date();
}

function scheduleNext(
  lead: Lead,
  campaign: Campaign,
  current: CampaignFlowStep,
  branch = lead.currentBranch,
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
  lead.nextStepAt = scheduleAt(next);
}

export async function markLeadAccepted(lead: Lead, campaign: Campaign) {
  if (lead.status === "replied" || lead.status === "failed" || lead.status === "flow_completed") {
    return lead;
  }
  if (lead.history.some((event) => event.kind === "accepted")) return lead;
  appendHistory(lead, "accepted");
  lead.currentBranch = "accepted";
  lead.awaiting = "";
  lead.status = "queued";
  lead.stage = "message_1";
  const next = firstBranchStep(campaign.flow, "accepted");
  if (next) {
    lead.nextStepId = next.id;
    lead.nextStepAt = scheduleAt(next);
  } else {
    lead.status = "flow_completed";
    lead.stage = "flow_completed";
    lead.nextStepId = "";
    lead.nextStepAt = undefined;
  }
  return saveLead(lead);
}

export async function markLeadReplied(lead: Lead, campaign: Campaign, body: string) {
  if (lead.status === "replied") return lead;
  const at = new Date();
  appendHistory(lead, "replied");
  lead.status = "replied";
  lead.awaiting = "";
  lead.nextStepId = "";
  lead.nextStepAt = undefined;
  lead.firstReplyReceivedAt = at;
  await createMessage({
    brandId: lead.brandId,
    campaignId: lead.campaignId,
    campaignName: campaign.name,
    leadId: lead.id,
    leadName: lead.fullName,
    direction: "inbound",
    body,
    sentAt: at,
  });
  await incrementDailyStat(lead.brandId, { replied: 1 }, lead.campaignId);
  await incrementCampaignCounters(lead.campaignId, { replied: 1 });
  return saveLead(lead);
}

async function executeStep(lead: Lead, campaign: Campaign, step: CampaignFlowStep, accountId: string) {
  if (step.kind === "profile_view" || step.kind === "connection_check") {
    const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
    const profile = await getUnipileProfile(accountId, identifier);
    lead.unipileProviderId = profile.provider_id || lead.unipileProviderId;
    if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
    if (profile.notify_visit_token) {
      try {
        await reportProfileVisit(accountId, profile.notify_visit_token);
      } catch (error) {
        console.error("[unipile] profile visit skipped:", error instanceof Error ? error.message : error);
      }
    }
    if (lead.awaiting === "connection" && isFirstDegree(profile)) {
      await applyUsage(lead.brandId, campaign.id, "views", step.id);
      appendHistory(lead, "profile_viewed");
      await saveLead(lead);
      return markLeadAccepted(lead, campaign);
    }
    appendHistory(lead, "profile_viewed");
    await applyUsage(lead.brandId, campaign.id, "views", step.id);
    if (lead.awaiting === "connection" && !lead.currentBranch) {
      lead.currentBranch = "no_response";
      const next = firstBranchStep(campaign.flow, "no_response");
      if (next && next.id !== step.id) {
        lead.nextStepId = next.id;
        lead.nextStepAt = scheduleAt(next);
      } else {
        scheduleNext(lead, campaign, step, "no_response");
      }
    } else {
      scheduleNext(lead, campaign, step);
    }
    return saveLead(lead);
  }

  const providerId = await resolveProviderId(accountId, lead);
  const body = stepCopy(step, lead);

  if (step.kind === "connection") {
    await sendUnipileInvitation(accountId, providerId, body);
    appendHistory(lead, "connection_sent");
    lead.status = "waiting_reply";
    lead.stage = "connection_request";
    lead.awaiting = "connection";
    const timeout = firstBranchStep(campaign.flow, "no_response");
    lead.nextStepId = timeout?.id ?? "";
    lead.nextStepAt = timeout ? scheduleAt(timeout) : undefined;
    await applyUsage(lead.brandId, campaign.id, "invites", step.id);
    await createMessage({
      brandId: lead.brandId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      leadId: lead.id,
      leadName: lead.fullName,
      direction: "outbound",
      body,
      sentAt: new Date(),
    });
    return saveLead(lead);
  }

  if (step.kind === "message" || step.kind === "inmail") {
    const chat = await startUnipileChat({
      accountId,
      attendeeId: providerId,
      text: body,
      inmail: step.kind === "inmail",
    });
    lead.unipileChatId = chat.chat_id || chat.id || lead.unipileChatId;
    if (step.kind === "inmail") {
      appendHistory(lead, "inmail_sent");
      lead.awaiting = "inmail";
      lead.status = "waiting_reply";
      const timeout = firstBranchStep(campaign.flow, "inmail_no_response");
      lead.nextStepId = timeout?.id ?? "";
      lead.nextStepAt = timeout ? scheduleAt(timeout) : undefined;
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
        scheduleNext(lead, campaign, step);
      }
    }
    await applyUsage(lead.brandId, campaign.id, "messages", step.id);
    await createMessage({
      brandId: lead.brandId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      leadId: lead.id,
      leadName: lead.fullName,
      direction: "outbound",
      body,
      sentAt: new Date(),
    });
    return saveLead(lead);
  }

  scheduleNext(lead, campaign, step);
  return saveLead(lead);
}

export async function runLeadStep(lead: Lead) {
  if (!isRunnable(lead)) return { skipped: true as const };
  const [brand, campaign] = await Promise.all([
    fetchBrand(lead.brandId),
    fetchCampaign(lead.campaignId),
  ]);
  if (!brand || !campaign) return { skipped: true as const };
  if (!isCampaignRunning(campaign.status)) {
    return { skipped: true as const };
  }
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) {
    lead.nextStepAt = tomorrowMorning();
    await saveLead(lead);
    return { deferred: "unipile-disconnected" as const };
  }

  if (isQuietHours()) {
    lead.nextStepAt = tomorrowMorning();
    await saveLead(lead);
    return { deferred: "quiet-hours" as const };
  }

  const step = findStep(campaign.flow, lead.nextStepId);
  if (!step) return { skipped: true as const };

  const caps = normalizePacing(brand.pacing);
  const usage = await todayPacingUsage(brand.id);
  const needsView = step.kind === "profile_view" || step.kind === "connection_check";
  const needsInvite = step.kind === "connection";
  const needsMessage = step.kind === "message" || step.kind === "inmail";
  if (
    (needsView && usage.views >= caps.dailyViews) ||
    (needsInvite && usage.invites >= caps.dailyInvites) ||
    (needsMessage && usage.messages >= caps.dailyMessages)
  ) {
    lead.nextStepAt = tomorrowMorning();
    await saveLead(lead);
    return { deferred: "pacing" as const };
  }

  try {
    await executeStep(lead, campaign, step, brand.unipileAccountId);
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

export async function runDueSequence(limit = 3) {
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
  for (const lead of due.slice(0, limit)) {
    results.processed += 1;
    const result = await runLeadStep(lead);
    if ("ok" in result && result.ok) results.ok += 1;
    else if ("deferred" in result) results.deferred += 1;
    else if ("failed" in result) results.failed += 1;
    else results.skipped += 1;
  }
  return results;
}

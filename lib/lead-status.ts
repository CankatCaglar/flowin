import { flowStepTitle } from "@/lib/campaign-flow";
import { historyHas, leadStatusLabelKey } from "@/lib/leads";
import { findStep, firstBranchStep, firstOpenStep, leadCompletedStep, nextStepInLane } from "@/lib/sequence";
import type { Campaign, CampaignFlowStep, CampaignStatus, Lead } from "@/types";

const NEXT_STEP_KEYS = new Set([
  "queued",
  "queued_view",
  "waiting_connection",
  "queued_message",
]);

function skipCompletedStep(lead: Lead, campaign: Campaign, step: CampaignFlowStep | null) {
  if (!step) return null;
  if (!leadCompletedStep(lead, step, campaign.flow)) return step;
  return nextStepInLane(campaign.flow, step.id, lead.currentBranch || step.branch || "");
}

export function leadNextFlowStep(lead: Lead, campaign?: Campaign, campaignStatus?: CampaignStatus) {
  if (!campaign) return null;
  const key = leadStatusLabelKey(lead, campaignStatus ?? campaign.status);
  if (key === "waiting_connection") {
    return campaign.flow.find((step) => step.kind === "connection" && !step.branch) ?? null;
  }
  if (key === "queued_view") return firstOpenStep(campaign.flow);
  if (key === "queued_message") {
    const current = skipCompletedStep(lead, campaign, findStep(campaign.flow, lead.nextStepId));
    if (current && current.branch === "accepted") return current;
    return firstBranchStep(campaign.flow, "accepted");
  }
  if (key === "waiting_inmail") {
    return campaign.flow.find((step) => step.kind === "inmail") ?? null;
  }
  const current = skipCompletedStep(lead, campaign, findStep(campaign.flow, lead.nextStepId));
  if (current) return current;
  if (key === "queued" && historyHas(lead, "connection_sent") && !historyHas(lead, "accepted")) {
    return (
      campaign.flow.find((step) => step.kind === "inmail") ??
      firstBranchStep(campaign.flow, "no_response")
    );
  }
  return null;
}

export function leadStatusLabel(
  lead: Lead,
  options: {
    campaign?: Campaign;
    campaignStatus?: CampaignStatus;
    locale: string;
    t: (key: string, values?: { step: string }) => string;
  },
) {
  const campaignStatus = options.campaignStatus ?? options.campaign?.status;
  const key = leadStatusLabelKey(lead, campaignStatus);
  const step = leadNextFlowStep(lead, options.campaign, campaignStatus);
  if (step && NEXT_STEP_KEYS.has(key)) {
    const title = flowStepTitle(step, options.locale).trim();
    if (title) {
      if (step.kind === "profile_view" || step.kind === "connection_check") {
        return options.t("nextView", { step: title });
      }
      return options.t("nextSend", { step: title });
    }
  }
  if (step && key === "waiting_inmail") {
    const title = flowStepTitle(step, options.locale).trim();
    if (title) return options.t("nextReply", { step: title });
  }
  return options.t(key);
}

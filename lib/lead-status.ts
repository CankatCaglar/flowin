import { flowStepTitle } from "@/lib/campaign-flow";
import { leadStatusLabelKey } from "@/lib/leads";
import { findStep, firstBranchStep, firstOpenStep } from "@/lib/sequence";
import type { Campaign, CampaignFlowStep, CampaignStatus, Lead } from "@/types";

const NEXT_STEP_KEYS = new Set([
  "queued",
  "queued_view",
  "waiting_connection",
  "queued_message",
]);

function queuedFlowStep(lead: Lead, campaign: Campaign, key: string): CampaignFlowStep | null {
  const current = findStep(campaign.flow, lead.nextStepId);
  if (current) return current;
  if (key === "queued_message") return firstBranchStep(campaign.flow, "accepted");
  if (key === "queued_view") return firstOpenStep(campaign.flow);
  if (key === "waiting_connection") {
    return campaign.flow.find((step) => step.kind === "connection" && !step.branch) ?? null;
  }
  if (key === "waiting_inmail") {
    return campaign.flow.find((step) => step.kind === "inmail") ?? null;
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
  const step = options.campaign ? queuedFlowStep(lead, options.campaign, key) : null;
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

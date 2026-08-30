import { splitFlowBranches } from "@/lib/campaign-flow";
import type { CampaignFlowStep, FlowBranch, Lead, LeadStage } from "@/types";

export function firstOpenStep(flow: CampaignFlowStep[]) {
  return splitFlowBranches(flow).trunk[0] ?? null;
}

export function findStep(flow: CampaignFlowStep[], stepId?: string) {
  if (!stepId) return null;
  return flow.find((step) => step.id === stepId) ?? null;
}

export function stepsInLane(flow: CampaignFlowStep[], branch?: FlowBranch | "") {
  const lanes = splitFlowBranches(flow);
  if (!branch) return lanes.trunk;
  if (branch === "accepted") return lanes.accepted;
  if (branch === "no_response") return lanes.noResponse;
  if (branch === "inmail_accepted") return lanes.inmailAccepted;
  return lanes.inmailNoResponse;
}

export function nextStepInLane(
  flow: CampaignFlowStep[],
  currentId: string,
  branch?: FlowBranch | "",
) {
  const lane = stepsInLane(flow, branch);
  const index = lane.findIndex((step) => step.id === currentId);
  if (index < 0) return lane[0] ?? null;
  return lane[index + 1] ?? null;
}

export function firstBranchStep(flow: CampaignFlowStep[], branch: FlowBranch) {
  return stepsInLane(flow, branch)[0] ?? null;
}

export function delayMs(step: CampaignFlowStep) {
  const amount = Math.max(0, Number(step.delayDays) || 0);
  return step.delayUnit === "hours" ? amount * 3_600_000 : amount * 86_400_000;
}

export function withJitter(baseMs: number) {
  const jitter =
    baseMs === 0
      ? (8 + Math.random() * 22) * 60_000
      : (25 + Math.random() * 140) * 60_000;
  return baseMs + jitter;
}

export function scheduleAt(step: CampaignFlowStep, from = new Date()) {
  return new Date(from.getTime() + withJitter(delayMs(step)));
}

export function tomorrowMorning(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(9 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 50), 0, 0);
  return next;
}

export function stageAfterMessageIndex(index: number): LeadStage {
  if (index <= 0) return "message_1";
  if (index === 1) return "message_2";
  if (index === 2) return "message_3";
  return "flow_completed";
}

export function messageIndexOnAcceptedPath(flow: CampaignFlowStep[], stepId: string) {
  const messages = splitFlowBranches(flow).accepted.filter((step) => step.kind === "message");
  return messages.findIndex((step) => step.id === stepId);
}

export function isRunnable(lead: Lead) {
  return lead.status === "queued" || lead.status === "waiting_reply";
}

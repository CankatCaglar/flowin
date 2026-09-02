import { splitFlowBranches } from "@/lib/campaign-flow";
import {
  addIstanbulDateKey,
  clockInIstanbul,
  isIstanbulWeekendKey,
  isQuietHours,
  istanbulDateKey,
  istanbulWallDate,
} from "@/lib/pacing";
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

function morningJitter() {
  return {
    hour: 9 + Math.floor(Math.random() * 2),
    minute: Math.floor(Math.random() * 50),
  };
}

function skipWeekendKey(key: string) {
  let next = key;
  while (isIstanbulWeekendKey(next)) next = addIstanbulDateKey(next, 1);
  return next;
}

/** Next Istanbul business morning, `skipDays` calendar days ahead (weekends skipped). */
export function nextBusinessMorning(from = new Date(), skipDays = 1) {
  let key = istanbulDateKey(from);
  for (let i = 0; i < skipDays; i += 1) key = addIstanbulDateKey(key, 1);
  key = skipWeekendKey(key);
  const { hour, minute } = morningJitter();
  return istanbulWallDate(key, hour, minute);
}

export function scheduleAt(step: CampaignFlowStep, from = new Date()) {
  const amount = Math.max(0, Number(step.delayDays) || 0);
  if (step.delayUnit === "hours") {
    return new Date(from.getTime() + withJitter(delayMs(step)));
  }
  if (amount <= 0) {
    if (isQuietHours(from)) return nextBusinessMorning(from, clockInIstanbul(from).weekend ? 1 : 0);
    return new Date(from.getTime() + withJitter(0));
  }
  return nextBusinessMorning(from, amount);
}

export function tomorrowMorning(from = new Date()) {
  const clock = clockInIstanbul(from);
  if (clock.weekend || clock.hour >= 18) return nextBusinessMorning(from, 1);
  if (clock.hour < 9) return nextBusinessMorning(from, 0);
  return nextBusinessMorning(from, 1);
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

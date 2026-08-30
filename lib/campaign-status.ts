import type { CampaignStatus } from "@/types";

export const CAMPAIGN_STATUSES = [
  "active",
  "expiring",
  "paused",
  "draft",
  "completed",
] as const;

export function isCampaignRunning(status: CampaignStatus) {
  return status === "active" || status === "expiring";
}

export function asCampaignStatus(value: unknown, fallback: CampaignStatus = "draft"): CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus)
    ? (value as CampaignStatus)
    : fallback;
}

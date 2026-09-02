import { cn } from "@/lib/utils";
import type { CampaignStatus, LeadStage, LeadStatus } from "@/types";

const statusClass: Record<CampaignStatus | LeadStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  paused: "bg-orange-50 text-orange-700",
  draft: "bg-sky-50 text-sky-700",
  completed: "bg-zinc-100 text-zinc-600",
  queued: "bg-amber-50 text-amber-800",
  waiting_reply: "bg-orange-50 text-orange-700",
  replied: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  flow_completed: "bg-zinc-100 text-zinc-600",
};

const stageClass: Record<LeadStage, string> = {
  connection_request: "bg-sky-50 text-sky-700",
  profile_viewed: "bg-violet-50 text-barney",
  message_1: "bg-sky-50 text-sky-700",
  message_2: "bg-sky-50 text-sky-700",
  message_3: "bg-sky-50 text-sky-700",
  flow_completed: "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({
  status,
  label,
}: {
  status: CampaignStatus | LeadStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        statusClass[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function StageBadge({
  stage,
  label,
}: {
  stage: LeadStage;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        stageClass[stage],
      )}
    >
      {label}
    </span>
  );
}

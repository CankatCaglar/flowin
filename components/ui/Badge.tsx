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

const statusTextClass: Record<CampaignStatus | LeadStatus, string> = {
  active: "text-emerald-700",
  expiring: "text-amber-700",
  paused: "text-orange-700",
  draft: "text-sky-700",
  completed: "text-zinc-600",
  queued: "text-amber-800",
  waiting_reply: "text-orange-700",
  replied: "text-emerald-700",
  failed: "text-rose-700",
  flow_completed: "text-zinc-600",
};

const stageTextClass: Record<LeadStage, string> = {
  pending: "text-zinc-500",
  profile_viewed: "text-barney",
  connection_request: "text-sky-700",
  accepted: "text-emerald-700",
  inmail: "text-sky-700",
  message_1: "text-sky-700",
  message_2: "text-sky-700",
  message_3: "text-sky-700",
  flow_completed: "text-emerald-700",
};

export function StatusBadge({
  status,
  label,
  plain = false,
}: {
  status: CampaignStatus | LeadStatus;
  label: string;
  plain?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        plain ? statusTextClass[status] : ["rounded-full px-2 py-0.5", statusClass[status]],
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
    <span className={cn("inline-flex text-[11px] font-semibold", stageTextClass[stage])}>
      {label}
    </span>
  );
}

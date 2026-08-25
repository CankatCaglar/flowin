import { cn } from "@/lib/utils";
import type { CampaignStatus, LeadStage, LeadStatus } from "@/types";

const statusClass: Record<CampaignStatus | LeadStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  draft: "bg-sky-50 text-sky-700",
  completed: "bg-zinc-100 text-zinc-600",
  unresponsive: "bg-orange-50 text-orange-700",
  replied: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-sky-50 text-sky-700",
};

const stageClass: Record<LeadStage, string> = {
  first_contact: "bg-violet-50 text-violet-700",
  interested: "bg-purple-50 text-purple-700",
  proposal: "bg-amber-50 text-amber-800",
  awaiting_reply: "bg-orange-50 text-orange-700",
  replied: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
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

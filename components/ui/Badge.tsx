import { cn } from "@/lib/utils";
import type { CampaignStatus, LeadStatus } from "@/types";

const statusClass: Record<CampaignStatus | LeadStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  completed: "bg-zinc-100 text-zinc-600",
  unresponsive: "bg-orange-50 text-orange-700",
  replied: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-sky-50 text-sky-700",
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
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        statusClass[status],
      )}
    >
      {label}
    </span>
  );
}

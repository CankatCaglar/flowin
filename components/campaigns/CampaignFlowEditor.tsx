"use client";

import { ChevronRight, Clock3, MessageSquare, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { waitBadgeKey } from "@/lib/campaign-flow";
import { cn } from "@/lib/utils";
import type { CampaignFlowStep, FlowStepKind } from "@/types";

const icons: Record<FlowStepKind, typeof UserPlus> = {
  connection: UserPlus,
  message: MessageSquare,
  connection_check: Clock3,
};

export function CampaignFlowEditor({
  steps,
  selectedId,
  onSelect,
}: {
  steps: CampaignFlowStep[];
  selectedId?: string | null;
  onSelect: (step: CampaignFlowStep) => void;
}) {
  const t = useTranslations("campaigns.flow");

  return (
    <div className="surface-card rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">Flow</h2>
      <div className="relative mx-auto mt-6 max-w-88">
        <span
          aria-hidden
          className="absolute bottom-6 left-1/2 top-6 w-px -translate-x-1/2 border-l border-dashed border-purple-jam/25"
        />
        <div className="relative space-y-0">
          {steps.map((step, index) => {
            const Icon = icons[step.kind];
            const selected = selectedId === step.id;
            const next = steps[index + 1];
            const showWait = Boolean(next) && (next?.delayDays ?? 0) > 0;
            return (
              <div key={step.id}>
                <button
                  type="button"
                  onClick={() => onSelect(step)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left shadow-sm",
                    selected
                      ? "border-barney"
                      : "border-purple-jam/12 hover:border-barney/35",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-barney/10 text-barney">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 font-display text-sm font-semibold text-ink">
                    {step.title}
                  </span>
                  {step.kind !== "connection" ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  ) : null}
                </button>
                {index < steps.length - 1 ? (
                  <div className="relative z-10 flex justify-center py-2.5">
                    {showWait ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-jam/12 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
                        <Clock3 className="h-3.5 w-3.5 text-muted" />
                        {t(waitBadgeKey(next?.delayUnit), { count: next?.delayDays ?? 0 })}
                      </span>
                    ) : (
                      <span className="h-4 w-px" />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { ChevronRight, Clock3, MessageSquare, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { waitBadgeKey } from "@/lib/campaign-flow";
import type { CampaignFlowStep, FlowDelayUnit, FlowStepKind } from "@/types";

const icons: Record<FlowStepKind, typeof UserPlus> = {
  connection: UserPlus,
  message: MessageSquare,
  connection_check: Clock3,
};

const UNITS: FlowDelayUnit[] = ["days", "hours"];

export function CreateCampaignFlow({
  steps,
  onChangeDelay,
  onEdit,
}: {
  steps: CampaignFlowStep[];
  onChangeDelay: (stepId: string, delayDays: number, delayUnit: FlowDelayUnit) => void;
  onEdit: (step: CampaignFlowStep) => void;
}) {
  const t = useTranslations("campaigns.flow");
  const createT = useTranslations("campaigns.create");

  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute bottom-6 left-4 top-6 border-l border-dashed border-barney/40"
      />
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = icons[step.kind];
          const next = steps[index + 1];
          const waitValue = next?.delayDays ?? 0;
          const waitUnit: FlowDelayUnit = next?.delayUnit === "hours" ? "hours" : "days";
          const hasWait = Boolean(next);
          return (
            <div key={step.id} className="relative flex items-center gap-3 pl-0">
              <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-barney text-white">
                <Icon className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={() => onEdit(step)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
              >
                <span className="font-display text-sm font-semibold text-ink">
                  {step.title}
                </span>
                {step.kind === "message" ? (
                  <ChevronRight className="h-4 w-4 text-muted" />
                ) : null}
              </button>
              {hasWait && next ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-sm text-muted sm:inline">
                    {t(waitBadgeKey(waitUnit), { count: waitValue })}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={waitUnit === "hours" ? 72 : 30}
                    value={waitValue}
                    aria-label={createT("waitAfter")}
                    onChange={(event) =>
                      onChangeDelay(next.id, Number(event.target.value) || 0, waitUnit)
                    }
                    className="no-spinner h-9 w-14 rounded-lg border border-purple-jam/15 bg-white px-2 text-center text-sm text-ink outline-none focus:border-barney/50"
                  />
                  <SelectMenu
                    id={`delay-unit-${next.id}`}
                    value={waitUnit}
                    ariaLabel={createT("waitUnit")}
                    align="right"
                    className="w-24"
                    triggerClassName="h-9 rounded-lg px-2.5"
                    options={UNITS.map((unit) => ({
                      value: unit,
                      label: unit === "hours" ? createT("unitHours") : createT("unitDays"),
                    }))}
                    onChange={(unit) =>
                      onChangeDelay(next.id, waitValue, unit as FlowDelayUnit)
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CreateFlowPreview({ steps }: { steps: CampaignFlowStep[] }) {
  const t = useTranslations("campaigns.flow");

  return (
    <div className="flex h-full min-h-56 flex-col">
      {steps.map((step, index) => {
        const Icon = icons[step.kind];
        const next = steps[index + 1];
        const last = index === steps.length - 1;
        return (
          <div key={step.id} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-barney/10 text-barney">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[13px] font-medium text-ink">
                {step.title}
              </span>
            </div>
            {!last && next ? (
              <div className="grid min-h-14 flex-1 grid-cols-[2.5rem_minmax(0,1fr)]">
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-barney/30"
                  />
                  <span
                    aria-hidden
                    className="absolute top-1/2 right-0 left-1/2 border-t border-dashed border-barney/30"
                  />
                </div>
                <div className="flex items-center">
                  <span className="rounded-full border border-barney/20 bg-barney/5 px-3 py-1.5 text-xs font-medium text-barney">
                    {t(waitBadgeKey(next.delayUnit), { count: next.delayDays })}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

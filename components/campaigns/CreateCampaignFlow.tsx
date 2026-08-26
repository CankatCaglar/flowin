"use client";

import { Fragment } from "react";
import { CheckCircle2, ChevronRight, Clock3, MinusCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { flowStepTitle, splitFlowBranches, waitBadgeKey } from "@/lib/campaign-flow";
import { flowStepIcons } from "@/lib/flow-icons";
import { cn } from "@/lib/utils";
import type { CampaignFlowStep, FlowBranch, FlowDelayUnit } from "@/types";

const UNITS: FlowDelayUnit[] = ["days", "hours"];
const LINE = "border-dashed border-barney/30";

const BRANCH_HINTS: Record<FlowBranch, string> = {
  accepted: "branchAcceptedHint",
  no_response: "branchNoResponseHint",
  inmail_accepted: "branchInmailAcceptedHint",
  inmail_no_response: "branchInmailNoResponseHint",
};

function isAcceptedBranch(branch: FlowBranch) {
  return branch === "accepted" || branch === "inmail_accepted";
}

function BranchLabel({ branch }: { branch: FlowBranch }) {
  const t = useTranslations("campaigns.flow");
  const accepted = isAcceptedBranch(branch);
  const Icon = accepted ? CheckCircle2 : MinusCircle;
  return (
    <div className="flex items-center gap-2 pl-0">
      <span
        className={cn(
          "relative z-10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
          accepted
            ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700"
            : "border-purple-jam/15 bg-canvas text-muted",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {accepted ? t("branchAccepted") : t("branchNoResponse")}
      </span>
      <span className="text-[11px] text-muted">{t(BRANCH_HINTS[branch])}</span>
      <span aria-hidden className={cn("h-px flex-1 border-t", LINE)} />
    </div>
  );
}

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
  const locale = useLocale();
  const branches = splitFlowBranches(steps);

  const renderStep = (step: CampaignFlowStep, showWait: boolean) => {
    const Icon = flowStepIcons[step.kind];
    const waitUnit: FlowDelayUnit = step.delayUnit === "hours" ? "hours" : "days";
    const editable = step.kind !== "profile_view";

    return (
      <Fragment key={step.id}>
        {showWait ? (
          <div className="flex items-center gap-2 pl-4">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Clock3 className="h-3.5 w-3.5" />
              {t(waitBadgeKey(waitUnit), { count: step.delayDays })}
            </span>
            <input
              type="number"
              min={0}
              max={waitUnit === "hours" ? 72 : 30}
              value={step.delayDays}
              aria-label={createT("waitAfter")}
              onChange={(event) =>
                onChangeDelay(step.id, Number(event.target.value) || 0, waitUnit)
              }
              className="no-spinner h-9 w-14 rounded-lg border border-purple-jam/15 bg-white px-2 text-center text-sm text-ink outline-none focus:border-barney/50"
            />
            <SelectMenu
              id={`delay-unit-${step.id}`}
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
                onChangeDelay(step.id, step.delayDays, unit as FlowDelayUnit)
              }
            />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-barney text-white">
            <Icon className="h-4 w-4" />
          </span>
          {editable ? (
            <button
              type="button"
              onClick={() => onEdit(step)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left"
            >
              <span className="font-display text-sm font-semibold text-ink">
                {flowStepTitle(step, locale)}
              </span>
              {step.premium ? (
                <span className="rounded-md border border-barney/20 bg-barney/5 px-2 py-0.5 text-[10px] font-medium text-barney">
                  {t("premium")}
                </span>
              ) : null}
              <ChevronRight className="h-4 w-4 text-muted" />
            </button>
          ) : (
            <span className="min-w-0 flex-1 font-display text-sm font-semibold text-ink">
              {flowStepTitle(step, locale)}
            </span>
          )}
        </div>
      </Fragment>
    );
  };

  return (
    <div className="relative">
      <span aria-hidden className={cn("absolute bottom-6 left-4 top-6 border-l", LINE)} />
      <div className="space-y-4">
        {branches.trunk.map((step, index) => renderStep(step, index > 0))}
        {(
          [
            ["no_response", branches.noResponse],
            ["inmail_no_response", branches.inmailNoResponse],
            ["inmail_accepted", branches.inmailAccepted],
            ["accepted", branches.accepted],
          ] as const
        ).map(([branch, list]) =>
          list.length > 0 ? (
            <Fragment key={branch}>
              <BranchLabel branch={branch} />
              {list.map((step) => renderStep(step, true))}
            </Fragment>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function CreateFlowPreview({ steps }: { steps: CampaignFlowStep[] }) {
  const t = useTranslations("campaigns.flow");
  const locale = useLocale();
  const branches = splitFlowBranches(steps);

  const renderStep = (step: CampaignFlowStep, showWait: boolean) => {
    const Icon = flowStepIcons[step.kind];
    return (
      <Fragment key={step.id}>
        {showWait ? (
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] py-2">
            <div className="relative">
              <span
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-barney/30"
              />
            </div>
            <div className="flex items-center">
              <span className="text-xs font-medium text-muted">
                {t(waitBadgeKey(step.delayUnit), { count: step.delayDays })}
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-barney/10 text-barney">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[13px] font-medium text-ink">
            {flowStepTitle(step, locale)}
          </span>
          {step.premium ? (
            <span className="shrink-0 rounded-md border border-barney/20 bg-barney/5 px-1.5 py-0.5 text-[10px] font-medium text-barney">
              {t("premium")}
            </span>
          ) : null}
        </div>
      </Fragment>
    );
  };

  const renderBranch = (branch: FlowBranch, list: CampaignFlowStep[]) => {
    if (list.length === 0) return null;
    const isAccepted = isAcceptedBranch(branch);
    return (
      <div key={branch} className="mt-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              isAccepted
                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700"
                : "border-purple-jam/15 bg-canvas text-muted",
            )}
          >
            {isAccepted ? t("branchAccepted") : t("branchNoResponse")}
          </span>
          <span className="text-[11px] text-muted">{t(BRANCH_HINTS[branch])}</span>
          <span aria-hidden className="h-px flex-1 border-t border-dashed border-barney/25" />
        </div>
        <div className="mt-3">{list.map((step) => renderStep(step, true))}</div>
      </div>
    );
  };

  return (
    <div className="flex min-h-56 flex-col">
      {branches.trunk.map((step, index) => renderStep(step, index > 0))}
      {renderBranch("no_response", branches.noResponse)}
      {renderBranch("inmail_no_response", branches.inmailNoResponse)}
      {renderBranch("inmail_accepted", branches.inmailAccepted)}
      {renderBranch("accepted", branches.accepted)}
    </div>
  );
}

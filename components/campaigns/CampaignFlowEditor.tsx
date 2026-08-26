"use client";

import { Fragment, useEffect } from "react";
import { CheckCircle2, ChevronRight, Clock3, MinusCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { flowStepTitle, splitFlowBranches, waitBadgeKey } from "@/lib/campaign-flow";
import { flowStepIcons } from "@/lib/flow-icons";
import { cn } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

const LINE = "border-dashed border-purple-jam/25";

function isEditable(step: CampaignFlowStep) {
  return step.kind !== "profile_view";
}

function WaitRow({ step }: { step: CampaignFlowStep }) {
  const t = useTranslations("campaigns.flow");
  // A step without a wait keeps the badge's footprint so cards on parallel
  // branches stay on the same line; the dashed rail runs through the gap.
  const empty = step.delayDays <= 0;
  return (
    <div className="flex justify-center py-3.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-purple-jam/12 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm",
          empty && "invisible",
        )}
      >
        <Clock3 className="h-3.5 w-3.5 text-muted" />
        {t(waitBadgeKey(step.delayUnit), { count: step.delayDays })}
      </span>
    </div>
  );
}

function StepCard({
  step,
  selected,
  onSelect,
}: {
  step: CampaignFlowStep;
  selected: boolean;
  onSelect: (step: CampaignFlowStep) => void;
}) {
  const t = useTranslations("campaigns.flow");
  const locale = useLocale();
  const Icon = flowStepIcons[step.kind];
  const editable = isEditable(step);

  const content = (
    <>
      {/* Fixed-width, centred group: every card in a column lines its icon and
          label up on the same x, instead of centring each label on its own. */}
      <span className="mx-auto flex w-full min-w-0 max-w-48 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-barney/10 text-barney">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 truncate font-display text-sm font-semibold text-ink">
          {flowStepTitle(step, locale)}
        </span>
        {step.premium ? (
          <span className="shrink-0 rounded-md border border-barney/20 bg-barney/5 px-2 py-0.5 text-[10px] font-medium text-barney">
            {t("premium")}
          </span>
        ) : null}
      </span>
      {editable ? (
        <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      ) : null}
    </>
  );

  const shell = cn(
    "relative flex w-full items-center rounded-xl border bg-white px-9 py-3 text-left shadow-sm transition-colors",
    selected && editable ? "border-barney" : "border-purple-jam/12",
    editable && !selected ? "hover:border-barney/35" : null,
  );

  if (!editable) {
    return <div className={shell}>{content}</div>;
  }

  return (
    <button
      type="button"
      data-flow-step
      onClick={() => onSelect(step)}
      className={shell}
    >
      {content}
    </button>
  );
}

function FlowColumn({
  steps,
  leadingWait,
  selectedId,
  onSelect,
}: {
  steps: CampaignFlowStep[];
  leadingWait?: boolean;
  selectedId?: string | null;
  onSelect: (step: CampaignFlowStep) => void;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute bottom-5 left-1/2 w-px -translate-x-1/2 border-l",
          leadingWait ? "top-0" : "top-5",
          LINE,
        )}
      />
      <div className="relative">
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            {index > 0 || leadingWait ? <WaitRow step={step} /> : null}
            <StepCard
              step={step}
              selected={selectedId === step.id}
              onSelect={onSelect}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function BranchHeader({
  accepted,
  label,
  hint,
}: {
  accepted: boolean;
  label: string;
  hint: string;
}) {
  const Icon = accepted ? CheckCircle2 : MinusCircle;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
          accepted
            ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700"
            : "border-purple-jam/15 bg-canvas text-muted",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-[11px] text-muted">{hint}</span>
    </div>
  );
}

/** Short dashed stem that keeps the connector continuous between sections. */
function Stem({ className = "h-6" }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)} aria-hidden>
      <span className={cn("w-px border-l", LINE)} />
    </div>
  );
}

/** Horizontal rail that carries one incoming stem out to two column centres. */
function SplitRail() {
  return (
    <div className="hidden grid-cols-2 gap-6 md:grid" aria-hidden>
      <div className="relative h-6">
        <span className={cn("absolute -right-3 left-1/2 top-0 border-t", LINE)} />
        <span
          className={cn("absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 border-l", LINE)}
        />
      </div>
      <div className="relative h-6">
        <span className={cn("absolute -left-3 right-1/2 top-0 border-t", LINE)} />
        <span
          className={cn("absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 border-l", LINE)}
        />
      </div>
    </div>
  );
}

export function CampaignFlowEditor({
  steps,
  selectedId,
  onSelect,
  onClear,
}: {
  steps: CampaignFlowStep[];
  selectedId?: string | null;
  onSelect: (step: CampaignFlowStep) => void;
  onClear?: () => void;
}) {
  const t = useTranslations("campaigns.flow");

  // Pointer down anywhere that isn't a step drops the highlight.
  useEffect(() => {
    if (!onClear || !selectedId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-flow-step]")) return;
      onClear();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClear, selectedId]);

  const { trunk, accepted, noResponse, inmailAccepted, inmailNoResponse } =
    splitFlowBranches(steps);
  const hasBranches = accepted.length > 0 || noResponse.length > 0;
  const hasInmailBranches = inmailAccepted.length > 0 || inmailNoResponse.length > 0;

  const column = (branchSteps: CampaignFlowStep[]) => (
    <FlowColumn
      steps={branchSteps}
      leadingWait
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );

  return (
    <div className="surface-card rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-ink">{t("heading")}</h2>

      <div className="mt-6">
        <div className="mx-auto max-w-80">
          <FlowColumn steps={trunk} selectedId={selectedId} onSelect={onSelect} />
        </div>

        {hasBranches ? (
          <>
            <Stem />
            <SplitRail />
            <div className="grid gap-6 md:grid-cols-2">
              {/* Silent path — splits once more after the InMail. */}
              <div className="w-full">
                <div className="mx-auto w-full max-w-80">
                  <BranchHeader
                    accepted={false}
                    label={t("branchNoResponse")}
                    hint={t("branchNoResponseHint")}
                  />
                  <Stem className="h-3" />
                  {column(noResponse)}
                </div>
                {hasInmailBranches ? (
                  <>
                    <Stem />
                    <SplitRail />
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="mx-auto w-full max-w-80">
                        <BranchHeader
                          accepted={false}
                          label={t("branchNoResponse")}
                          hint={t("branchInmailNoResponseHint")}
                        />
                        <Stem className="h-3" />
                        {column(inmailNoResponse)}
                      </div>
                      <div className="mx-auto w-full max-w-80">
                        <BranchHeader
                          accepted
                          label={t("branchAccepted")}
                          hint={t("branchInmailAcceptedHint")}
                        />
                        <Stem className="h-3" />
                        {column(inmailAccepted)}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="mx-auto w-full max-w-80">
                <BranchHeader
                  accepted
                  label={t("branchAccepted")}
                  hint={t("branchAcceptedHint")}
                />
                <Stem className="h-3" />
                {column(accepted)}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

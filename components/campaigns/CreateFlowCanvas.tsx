"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Clock3, Minus, MinusCircle, Plus, Scan } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { flowStepTitle, splitFlowBranches, waitBadgeKey } from "@/lib/campaign-flow";
import { flowStepIcons } from "@/lib/flow-icons";
import { cn } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

const LINE = "border-dashed border-purple-jam/25";
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;
const ZOOM_STEP = 0.1;
const WHEEL_STEP = 0.1;
const WHEEL_PIXELS_PER_STEP = 80;
const WHEEL_MAX_STEPS = 2;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function snapZoom(value: number) {
  const snapped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return clampScale(Number(snapped.toFixed(1)));
}

function snapWheelZoom(value: number) {
  return clampScale(Math.round(value / WHEEL_STEP) * WHEEL_STEP);
}

function wheelPixels(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * 120;
  return event.deltaY;
}

function isEditable(step: CampaignFlowStep) {
  return step.kind !== "profile_view";
}

function WaitRow({ step }: { step: CampaignFlowStep }) {
  const t = useTranslations("campaigns.flow");
  const empty = step.delayDays <= 0;
  return (
    <div className="flex h-16 items-center justify-center">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-purple-jam/12 bg-white px-2.5 py-1.5 text-[11px] leading-5 font-medium text-ink shadow-sm",
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
      <span className="flex items-center justify-center gap-2">
        <span className="shrink-0 text-barney">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="py-0.5 font-sans text-[13px] font-semibold leading-6 text-ink">
          {flowStepTitle(step, locale)}
        </span>
        {step.premium ? (
          <span className="shrink-0 rounded-md border border-barney/20 bg-barney/5 px-1.5 py-0.5 text-[10px] font-medium text-barney">
            {t("premium")}
          </span>
        ) : null}
      </span>
      {editable ? (
        <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
      ) : null}
    </>
  );
  const shell = cn(
    "relative flex w-[13.5rem] cursor-pointer items-center justify-center rounded-xl border bg-white px-7 py-2.5 shadow-sm transition-colors",
    selected && editable ? "border-barney" : "border-purple-jam/12",
    editable && !selected ? "hover:border-barney/35" : null,
  );

  if (!editable) {
    return <div className={shell}>{content}</div>;
  }

  return (
    <button type="button" data-flow-step onClick={() => onSelect(step)} className={shell}>
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
    <div className="relative w-[13.5rem]">
      <span
        aria-hidden
        className={cn(
          "absolute bottom-4 left-1/2 w-px -translate-x-1/2 border-l",
          leadingWait ? "top-0" : "top-4",
          LINE,
        )}
      />
      <div className="relative">
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            {index > 0 || leadingWait ? <WaitRow step={step} /> : null}
            <StepCard step={step} selected={selectedId === step.id} onSelect={onSelect} />
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
    <div className="flex w-[13.5rem] flex-col items-center gap-1 text-center">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] leading-5 font-medium",
          accepted
            ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700"
            : "border-purple-jam/15 bg-canvas text-muted",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-[10px] leading-4 text-muted">{hint}</span>
    </div>
  );
}

function Stem({ className = "h-6" }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)} aria-hidden>
      <span className={cn("w-px border-l", LINE)} />
    </div>
  );
}

const COL_REM = 13.5;
const GAP_REM = 2;

function SplitRail({
  leftWidthRem,
  rightWidthRem,
}: {
  leftWidthRem: number;
  rightWidthRem: number;
}) {
  const width = leftWidthRem + GAP_REM + rightWidthRem;
  const leftDrop = leftWidthRem / 2;
  const rightDrop = leftWidthRem + GAP_REM + rightWidthRem / 2;
  return (
    <div className="relative h-6" style={{ width: `${width}rem` }} aria-hidden>
      <span
        className={cn("absolute top-0 border-t", LINE)}
        style={{ left: `${leftDrop}rem`, width: `${rightDrop - leftDrop}rem` }}
      />
      <span
        className={cn("absolute top-0 h-6 w-px -translate-x-1/2 border-l", LINE)}
        style={{ left: `${leftDrop}rem` }}
      />
      <span
        className={cn("absolute top-0 h-6 w-px -translate-x-1/2 border-l", LINE)}
        style={{ left: `${rightDrop}rem` }}
      />
    </div>
  );
}

export function CreateFlowCanvas({
  steps,
  selectedId,
  onSelect,
}: {
  steps: CampaignFlowStep[];
  selectedId?: string | null;
  onSelect: (step: CampaignFlowStep) => void;
}) {
  const t = useTranslations("campaigns.flow");
  const createT = useTranslations("campaigns.create");
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitLocked = useRef(true);
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  const zoomRafRef = useRef(0);
  const wheelAccRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const measureFit = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return null;
    const width = viewport.clientWidth - 32;
    const height = viewport.clientHeight - 32;
    if (width <= 0 || height <= 0 || !content.scrollWidth || !content.scrollHeight) {
      return null;
    }
    return snapZoom(
      Math.min(1, width / content.scrollWidth, height / content.scrollHeight),
    );
  }, []);

  const applyFit = useCallback(() => {
    const next = measureFit();
    if (next == null) return;
    setFitScale(next);
    if (fitLocked.current) {
      scaleRef.current = next;
      targetScaleRef.current = next;
      setScale(next);
      setPan({ x: 0, y: 0 });
    }
  }, [measureFit]);

  const breakFit = useCallback(() => {
    fitLocked.current = false;
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    applyFit();
    const observer = new ResizeObserver(applyFit);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [applyFit, steps]);

  const commitScale = useCallback((next: number) => {
    const clamped = clampScale(next);
    scaleRef.current = clamped;
    targetScaleRef.current = clamped;
    setScale(clamped);
  }, []);

  const zoomToward = useCallback((next: number) => {
    targetScaleRef.current = clampScale(next);
    if (zoomRafRef.current) return;
    const tick = () => {
      const current = scaleRef.current;
      const target = targetScaleRef.current;
      const blended = current + (target - current) * 0.2;
      if (Math.abs(blended - target) < 0.002) {
        scaleRef.current = target;
        setScale(target);
        zoomRafRef.current = 0;
        return;
      }
      scaleRef.current = blended;
      setScale(blended);
      zoomRafRef.current = requestAnimationFrame(tick);
    };
    zoomRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      breakFit();
      wheelAccRef.current += wheelPixels(event);
      let next = targetScaleRef.current;
      let steps = 0;
      while (Math.abs(wheelAccRef.current) >= WHEEL_PIXELS_PER_STEP && steps < WHEEL_MAX_STEPS) {
        const dir = wheelAccRef.current > 0 ? -1 : 1;
        wheelAccRef.current -= Math.sign(wheelAccRef.current) * WHEEL_PIXELS_PER_STEP;
        next = snapWheelZoom(next + dir * WHEEL_STEP);
        steps += 1;
      }
      if (steps > 0) zoomToward(next);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
    };
  }, [breakFit, zoomToward]);

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    dragRef.current = null;
    setDragging(false);
  };

  const { trunk, accepted, noResponse, inmailAccepted, inmailNoResponse } =
    splitFlowBranches(steps);
  const hasBranches = accepted.length > 0 || noResponse.length > 0;
  const hasInmailBranches = inmailAccepted.length > 0 || inmailNoResponse.length > 0;
  const column = (branchSteps: CampaignFlowStep[]) => (
    <FlowColumn steps={branchSteps} leadingWait selectedId={selectedId} onSelect={onSelect} />
  );

  return (
    <div className="flex h-full min-h-80 flex-col overflow-hidden rounded-xl border border-purple-jam/12 bg-canvas/50">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-purple-jam/10 bg-white/80 px-2 py-1">
        <button
          type="button"
          aria-label={createT("zoomOut")}
          onClick={() => {
            breakFit();
            commitScale(snapZoom(scaleRef.current - ZOOM_STEP));
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-12 text-center text-xs font-medium tabular-nums text-ink">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          aria-label={createT("zoomIn")}
          onClick={() => {
            breakFit();
            commitScale(snapZoom(scaleRef.current + ZOOM_STEP));
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={createT("zoomFit")}
          onClick={() => {
            fitLocked.current = true;
            applyFit();
          }}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium hover:bg-canvas hover:text-ink",
            scale === fitScale ? "text-ink" : "text-muted",
          )}
        >
          <Scan className="h-3.5 w-3.5" />
          {createT("zoomFit")}
        </button>
      </div>
      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-0 flex-1 touch-none overflow-hidden select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as HTMLElement).closest("[data-flow-step]")) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (event.clientX !== drag.startX || event.clientY !== drag.startY) {
            breakFit();
          }
          setPan({
            x: drag.panX + (event.clientX - drag.startX),
            y: drag.panY + (event.clientY - drag.startY),
          });
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center overflow-visible subpixel-antialiased"
          style={{
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <div ref={contentRef} className="inline-flex flex-col items-center px-1 pb-4 pt-1">
            <FlowColumn steps={trunk} selectedId={selectedId} onSelect={onSelect} />
            {hasBranches ? (
              <>
                <Stem />
                <SplitRail
                  leftWidthRem={hasInmailBranches ? COL_REM * 2 + GAP_REM : COL_REM}
                  rightWidthRem={COL_REM}
                />
                <div className="flex items-start justify-center gap-8">
                  <div className="flex flex-col items-center">
                    <BranchHeader
                      accepted={false}
                      label={t("branchNoResponse")}
                      hint={t("branchNoResponseHint")}
                    />
                    {column(noResponse)}
                    {hasInmailBranches ? (
                      <>
                        <Stem />
                        <SplitRail leftWidthRem={COL_REM} rightWidthRem={COL_REM} />
                        <div className="flex items-start gap-8">
                          <div className="flex flex-col items-center">
                            <BranchHeader
                              accepted={false}
                              label={t("branchNoResponse")}
                              hint={t("branchInmailNoResponseHint")}
                            />
                            {column(inmailNoResponse)}
                          </div>
                          <div className="flex flex-col items-center">
                            <BranchHeader
                              accepted
                              label={t("branchAccepted")}
                              hint={t("branchInmailAcceptedHint")}
                            />
                            {column(inmailAccepted)}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-center">
                    <BranchHeader
                      accepted
                      label={t("branchAccepted")}
                      hint={t("branchAcceptedHint")}
                    />
                    {column(accepted)}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types";

const FILTERS: Array<"all" | CampaignStatus> = [
  "all",
  "active",
  "paused",
  "expiring",
  "draft",
  "completed",
];

export function CampaignStatusFilter({
  value,
  onChange,
  layout = "auto",
  className,
}: {
  value: (typeof FILTERS)[number];
  onChange: (value: (typeof FILTERS)[number]) => void;
  layout?: "auto" | "select";
  className?: string;
}) {
  const t = useTranslations("campaigns");
  const statusT = useTranslations("status");
  const slotRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  const options = useMemo(
    () =>
      FILTERS.map((item) => ({
        value: item,
        label: item === "all" ? t("filterAll") : statusT(item),
      })),
    [statusT, t],
  );

  useLayoutEffect(() => {
    if (layout === "select") return;
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;

    const update = () => {
      setCompact(measure.scrollWidth > slot.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [layout, options]);

  const useSelect = layout === "select" || compact;

  return (
    <div
      ref={slotRef}
      className={cn(
        "relative min-w-0 overflow-hidden",
        layout === "select" ? "min-h-9 sm:min-h-10" : "min-h-10 flex-1",
        className,
      )}
    >
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex h-10 items-center gap-2"
      >
        {options.map((item) => (
          <span
            key={item.value}
            className="h-10 shrink-0 whitespace-nowrap rounded-xl border px-3 text-sm"
          >
            {item.label}
          </span>
        ))}
      </div>
      {useSelect ? (
        <SelectMenu
          id="campaigns-status-filter"
          className="w-full"
          triggerClassName="h-9 border-barney px-2 text-xs font-medium text-barney sm:h-10 sm:px-3 sm:text-sm"
          value={value}
          ariaLabel={t("status")}
          options={options}
          onChange={(next) => onChange(next as (typeof FILTERS)[number])}
        />
      ) : (
        <div className="flex h-10 items-center gap-2">
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value as (typeof FILTERS)[number])}
              className={cn(
                "h-10 shrink-0 whitespace-nowrap rounded-xl border px-3 text-sm",
                value === item.value
                  ? "border-barney bg-white font-medium text-barney"
                  : "border-purple-jam/15 bg-white text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

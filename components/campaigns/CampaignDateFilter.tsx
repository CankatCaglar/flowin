"use client";

import { useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AnchoredMenu,
  SelectOptionCheck,
  selectOptionClass,
} from "@/components/ui/SelectMenu";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { cn } from "@/lib/utils";

export type CampaignDatePreset = "all" | "last7" | "thisMonth";

export function CampaignDateFilter({
  value,
  onChange,
  className,
}: {
  value: CampaignDatePreset;
  onChange: (value: CampaignDatePreset) => void;
  className?: string;
}) {
  const t = useTranslations("campaigns");
  const header = useTranslations("header");
  const { open, toggle, close } = useMenu("campaigns-date-filter");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);

  const options: { value: CampaignDatePreset; label: string }[] = [
    { value: "all", label: t("allDates") },
    { value: "last7", label: header("last7") },
    { value: "thisMonth", label: header("thisMonth") },
  ];
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative min-w-0", className)} ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected?.label}
        title={selected?.label}
        className="inline-flex h-9 w-full min-w-0 items-center gap-1 rounded-xl border border-purple-jam/15 bg-white px-2 text-xs text-ink sm:h-10 sm:gap-1.5 sm:px-3 sm:text-sm"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-barney sm:h-4 sm:w-4" />
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform sm:h-4 sm:w-4", open && "rotate-180")}
        />
      </button>
      <AnchoredMenu open={open} anchorRef={rootRef} align="right" panelRef={panelRef}>
        <div role="listbox">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={selectOptionClass(active)}
              >
                <SelectOptionCheck selected={active} />
                {option.label}
              </button>
            );
          })}
        </div>
      </AnchoredMenu>
    </div>
  );
}

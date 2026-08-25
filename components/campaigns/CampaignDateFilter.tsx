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
}: {
  value: CampaignDatePreset;
  onChange: (value: CampaignDatePreset) => void;
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
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-purple-jam/15 bg-white px-3 text-sm text-ink"
      >
        <Calendar className="h-4 w-4 text-barney" />
        <span className="whitespace-nowrap">{selected?.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")}
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

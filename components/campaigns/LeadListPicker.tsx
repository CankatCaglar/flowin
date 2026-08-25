"use client";

import { useRef } from "react";
import { ChevronDown, FileText, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import {
  AnchoredMenu,
  selectOptionClass,
  SelectOptionCheck,
} from "@/components/ui/SelectMenu";
import { cn, formatDate } from "@/lib/utils";
import type { Campaign } from "@/types";

export function LeadListPicker({
  campaigns,
  selected,
  leadCount,
  onSelect,
}: {
  campaigns: Campaign[];
  selected: Campaign;
  leadCount: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("campaigns.create");
  const locale = useLocale();
  const { open, toggle, close } = useMenu("create-lead-list");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([triggerRef, panelRef], open, close);

  return (
    <div className="relative overflow-visible rounded-xl border border-purple-jam/15 bg-white">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold text-ink">
            {selected.name}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {t("createdOn", { date: formatDate(selected.createdAt, locale) })}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={triggerRef}
        matchWidth
        maxHeight={220}
        panelRef={panelRef}
      >
        <div role="listbox">
          {campaigns.map((campaign) => {
            const active = campaign.id === selected.id;
            return (
              <button
                key={campaign.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onSelect(campaign.id);
                  close();
                }}
                className={cn(selectOptionClass(active), "gap-3")}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-semibold text-ink group-hover:text-white">
                    {campaign.name}
                  </span>
                  <span className="block text-[11px] text-muted group-hover:text-white/80">
                    {t("createdOn", { date: formatDate(campaign.createdAt, locale) })}
                  </span>
                </span>
                <SelectOptionCheck selected={active} />
              </button>
            );
          })}
        </div>
      </AnchoredMenu>
      <div className="flex items-center gap-3 border-t border-purple-jam/10 px-3 py-3">
        <Users className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 text-sm text-ink">{t("selectedLeads")}</span>
        <span className="font-display text-sm font-semibold text-ink">{leadCount}</span>
      </div>
    </div>
  );
}

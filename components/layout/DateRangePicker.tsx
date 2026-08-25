"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AnchoredMenu, SelectOptionCheck, selectOptionClass } from "@/components/ui/SelectMenu";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import {
  APP_TODAY,
  minAllowedDate,
  parseDateKey,
  toDateKey,
} from "@/lib/dates";
import { formatDate } from "@/lib/utils";
import type { DatePreset } from "@/types";

export function DateRangePicker() {
  const t = useTranslations("header");
  const locale = useLocale();
  const { range, setPreset } = useDateRange();
  const { open, toggle, close } = useMenu("date-range");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);
  const [pickingCustom, setPickingCustom] = useState(range.preset === "custom");
  const [customStart, setCustomStart] = useState(toDateKey(range.start));
  const [customEnd, setCustomEnd] = useState(toDateKey(range.end));

  const min = toDateKey(minAllowedDate());
  const max = toDateKey(APP_TODAY);

  useEffect(() => {
    if (!open) return;
    setPickingCustom(range.preset === "custom");
    setCustomStart(toDateKey(range.start));
    setCustomEnd(toDateKey(range.end));
  }, [open, range]);

  const label =
    range.preset === "last7"
      ? t("last7")
      : range.preset === "thisMonth"
        ? t("thisMonth")
        : `${formatDate(range.start, locale)} - ${formatDate(range.end, locale)}`;

  const applyPreset = (preset: DatePreset) => {
    if (preset === "custom") {
      setPickingCustom(true);
      return;
    }
    setPickingCustom(false);
    setPreset(preset);
    close();
  };

  const selected = pickingCustom ? "custom" : range.preset;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-xl border border-purple-jam/15 bg-white px-3 py-2 text-sm text-ink"
      >
        <Calendar className="h-4 w-4 text-barney" />
        {label}
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={rootRef}
        align="right"
        maxHeight={360}
        panelRef={panelRef}
        className="w-72 p-3"
      >
        <div className="space-y-0.5">
          {(["last7", "thisMonth", "custom"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={selectOptionClass(selected === preset)}
            >
              <SelectOptionCheck selected={selected === preset} />
              {t(preset)}
            </button>
          ))}
        </div>
        {pickingCustom ? (
          <div className="mt-3 space-y-2 border-t border-purple-jam/10 pt-3">
            <label className="block text-xs text-muted">
              {t("from")}
              <input
                type="date"
                min={min}
                max={max}
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="mt-1 w-full rounded-lg border border-purple-jam/20 px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="block text-xs text-muted">
              {t("to")}
              <input
                type="date"
                min={min}
                max={max}
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="mt-1 w-full rounded-lg border border-purple-jam/20 px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <p className="text-[11px] leading-4 text-muted">{t("customHint")}</p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setPreset("custom", parseDateKey(customStart), parseDateKey(customEnd));
                close();
              }}
            >
              {t("apply")}
            </Button>
          </div>
        ) : null}
      </AnchoredMenu>
    </div>
  );
}

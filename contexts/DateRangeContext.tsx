"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { appToday, rangeForPreset } from "@/lib/dates";
import type { DatePreset, DateRange } from "@/types";

interface DateRangeContextValue {
  range: DateRange;
  now: Date;
  setPreset: (preset: DatePreset, start?: Date, end?: Date) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [now] = useState(() => appToday());
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("last7", undefined, undefined, now));

  const setPreset = (preset: DatePreset, start?: Date, end?: Date) => {
    setRange(rangeForPreset(preset, start, end, now));
  };

  const value = useMemo(() => ({ range, now, setPreset }), [range, now]);

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDateRange must be used within DateRangeProvider");
  }
  return context;
}

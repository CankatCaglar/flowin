import type { DatePreset, DateRange } from "@/types";

export const APP_TODAY = new Date(2026, 7, 23);
export const MAX_RANGE_DAYS = 366;

export function minAllowedDate(today = APP_TODAY) {
  return startOfDay(new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()));
}

export function clampDate(date: Date, today = APP_TODAY) {
  const min = minAllowedDate(today);
  const max = startOfDay(today);
  const value = startOfDay(date);
  if (Number.isNaN(value.getTime()) || value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampRange(start: Date, end: Date, today = APP_TODAY): DateRange {
  let from = clampDate(start, today);
  let to = clampDate(end, today);
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    from = clampDate(addDays(to, -(MAX_RANGE_DAYS - 1)), today);
  }
  return {
    preset: "custom",
    start: from,
    end: endOfDay(to),
  };
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function daysBetween(start: Date, end: Date) {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.round(ms / 86_400_000);
}

export function rangeForPreset(
  preset: DatePreset,
  customStart?: Date,
  customEnd?: Date,
  today = APP_TODAY,
): DateRange {
  if (preset === "thisMonth") {
    return {
      preset,
      start: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: endOfDay(today),
    };
  }

  if (preset === "custom" && customStart && customEnd) {
    return clampRange(customStart, customEnd, today);
  }

  return {
    preset: preset === "custom" ? "last7" : preset,
    start: startOfDay(addDays(today, -6)),
    end: endOfDay(today),
  };
}

export function previousRange(range: DateRange): DateRange {
  const length = Math.min(daysBetween(range.start, range.end) + 1, MAX_RANGE_DAYS);
  return {
    preset: range.preset,
    start: startOfDay(addDays(range.start, -length)),
    end: endOfDay(addDays(range.start, -1)),
  };
}

export function eachDateKey(range: DateRange) {
  const keys: string[] = [];
  let cursor = startOfDay(range.start);
  const last = startOfDay(range.end);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return keys;
  }

  let count = 0;
  while (cursor <= last && count < MAX_RANGE_DAYS) {
    keys.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
    count += 1;
  }
  return keys;
}

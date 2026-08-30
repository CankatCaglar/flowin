import type { BrandPacing } from "@/types";

/** Conservative ceilings — new / warming LinkedIn seats. */
export const DEFAULT_PACING: BrandPacing = {
  dailyInvites: 8,
  dailyMessages: 12,
  dailyViews: 15,
};

export function normalizePacing(input?: Partial<BrandPacing> | null): BrandPacing {
  return {
    dailyInvites: clampCap(input?.dailyInvites, DEFAULT_PACING.dailyInvites, 25),
    dailyMessages: clampCap(input?.dailyMessages, DEFAULT_PACING.dailyMessages, 40),
    dailyViews: clampCap(input?.dailyViews, DEFAULT_PACING.dailyViews, 40),
  };
}

function clampCap(value: unknown, fallback: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(1, Math.round(next)));
}

function clockInIstanbul(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = pick("weekday");
  return {
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
    weekend: weekday === "Sat" || weekday === "Sun",
  };
}

export function isQuietHours(at = new Date()) {
  const clock = clockInIstanbul(at);
  if (clock.weekend) return true;
  const minutes = clock.hour * 60 + clock.minute;
  return minutes < 9 * 60 || minutes >= 18 * 60;
}

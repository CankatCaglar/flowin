import type { BrandPacing } from "@/types";

/** Conservative ceilings after the campaign warmup ramp. */
export const DEFAULT_PACING: BrandPacing = {
  dailyInvites: 8,
  dailyMessages: 12,
  dailyViews: 15,
};

/** First calendar days of a campaign — stay under LinkedIn’s radar. */
const WARMUP: BrandPacing[] = [
  { dailyViews: 3, dailyInvites: 3, dailyMessages: 3 },
  { dailyViews: 5, dailyInvites: 5, dailyMessages: 5 },
  { dailyViews: 8, dailyInvites: 8, dailyMessages: 8 },
  { dailyViews: 12, dailyInvites: 8, dailyMessages: 10 },
];

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

export function clockInIstanbul(at = new Date()) {
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

export function istanbulDateKey(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addIstanbulDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isIstanbulWeekendKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  return weekday === "Sat" || weekday === "Sun";
}

/** Turkey is permanently UTC+3. */
export function istanbulWallDate(key: string, hour: number, minute: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0));
}

export function campaignAgeDays(start: Date, now = new Date()) {
  const from = istanbulDateKey(start);
  const to = istanbulDateKey(now);
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.max(
    0,
    Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000),
  );
}

export function warmupPacing(brand: BrandPacing, campaignStart: Date, now = new Date()): BrandPacing {
  const age = campaignAgeDays(campaignStart, now);
  const ramp = WARMUP[age];
  if (!ramp) return brand;
  return {
    dailyViews: Math.min(brand.dailyViews, ramp.dailyViews),
    dailyInvites: Math.min(brand.dailyInvites, ramp.dailyInvites),
    dailyMessages: Math.min(brand.dailyMessages, ramp.dailyMessages),
  };
}

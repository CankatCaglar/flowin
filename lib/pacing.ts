import type { BrandAlerts, BrandPacing, BrandSchedule } from "@/types";

/** Conservative ceilings after the campaign warmup ramp. */
export const DEFAULT_PACING: BrandPacing = {
  dailyInvites: 8,
  dailyMessages: 12,
  dailyViews: 15,
  dailyInmails: 5,
};

export const DEFAULT_SCHEDULE: BrandSchedule = {
  startHour: 9,
  endHour: 18,
  weekdays: [1, 2, 3, 4, 5],
};

export const DEFAULT_ALERTS: BrandAlerts = {
  connectionLost: true,
  sendFailed: true,
  lowLeads: true,
  dailyCap: true,
};

export function normalizeAlerts(input?: Partial<BrandAlerts> | null): BrandAlerts {
  return {
    connectionLost: input?.connectionLost !== false,
    sendFailed: input?.sendFailed !== false,
    lowLeads: input?.lowLeads !== false,
    dailyCap: input?.dailyCap !== false,
  };
}

/** First calendar days of a campaign — stay under LinkedIn’s radar. */
const WARMUP: BrandPacing[] = [
  { dailyViews: 8,  dailyInvites: 5,  dailyMessages: 5,  dailyInmails: 2 },
  { dailyViews: 12, dailyInvites: 8,  dailyMessages: 8,  dailyInmails: 3 },
  { dailyViews: 15, dailyInvites: 10, dailyMessages: 10, dailyInmails: 4 },
];

const ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function normalizePacing(input?: Partial<BrandPacing> | null): BrandPacing {
  return {
    dailyInvites: clampCap(input?.dailyInvites, DEFAULT_PACING.dailyInvites, 25),
    dailyMessages: clampCap(input?.dailyMessages, DEFAULT_PACING.dailyMessages, 40),
    dailyViews: clampCap(input?.dailyViews, DEFAULT_PACING.dailyViews, 40),
    dailyInmails: clampCap(input?.dailyInmails, DEFAULT_PACING.dailyInmails, 15),
  };
}

export function normalizeSchedule(input?: Partial<BrandSchedule> | null): BrandSchedule {
  const startHour = clampHour(input?.startHour, DEFAULT_SCHEDULE.startHour);
  const endHour = clampHour(input?.endHour, DEFAULT_SCHEDULE.endHour);
  const weekdays = Array.isArray(input?.weekdays)
    ? [...new Set(input.weekdays.map(Number).filter((day) => day >= 1 && day <= 7))].sort(
        (a, b) => a - b,
      )
    : DEFAULT_SCHEDULE.weekdays;
  return {
    startHour,
    endHour: endHour > startHour ? endHour : Math.min(23, startHour + 1),
    weekdays: weekdays.length ? weekdays : DEFAULT_SCHEDULE.weekdays,
  };
}

function clampCap(value: unknown, fallback: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(1, Math.round(next)));
}

function clampHour(value: unknown, fallback: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(23, Math.max(0, Math.round(next)));
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
    isoWeekday: ISO_WEEKDAY[weekday] ?? 1,
    weekend: weekday === "Sat" || weekday === "Sun",
  };
}

export function isWorkingDay(at = new Date(), schedule?: Partial<BrandSchedule> | null) {
  const hours = normalizeSchedule(schedule);
  return hours.weekdays.includes(clockInIstanbul(at).isoWeekday);
}

export function isQuietHours(at = new Date(), schedule?: Partial<BrandSchedule> | null) {
  const hours = normalizeSchedule(schedule);
  if (!isWorkingDay(at, hours)) return true;
  const clock = clockInIstanbul(at);
  const minutes = clock.hour * 60 + clock.minute;
  return minutes < hours.startHour * 60 || minutes >= hours.endHour * 60;
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

export function istanbulIsoWeekdayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  return ISO_WEEKDAY[weekday] ?? 1;
}

export function isIstanbulWeekendKey(key: string) {
  const day = istanbulIsoWeekdayKey(key);
  return day === 6 || day === 7;
}

/**
 * Deterministic pseudo-random float in [0, 1) based on an arbitrary seed string.
 * Uses FNV-1a 32-bit hash — fast, zero dependencies.
 */
function seededFloat(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296;
}

/**
 * Per-brand, per-day multiplier in [0.65, 1.0].
 * Same brand + same date → same value every cron run that day.
 * Different days → naturally different values → looks human to LinkedIn.
 */
export function dailyPacingMultiplier(dateKey: string, brandId: string): number {
  return 0.65 + seededFloat(`${dateKey}::${brandId}`) * 0.35;
}

/**
 * Apply daily variance to the effective pacing caps.
 * Call this after warmupPacing so warmup limits are already applied.
 */
export function variedPacing(caps: BrandPacing, dateKey: string, brandId: string): BrandPacing {
  const m = dailyPacingMultiplier(dateKey, brandId);
  return {
    dailyViews:    Math.max(1, Math.round(caps.dailyViews    * m)),
    dailyInvites:  Math.max(1, Math.round(caps.dailyInvites  * m)),
    dailyMessages: Math.max(1, Math.round(caps.dailyMessages * m)),
    dailyInmails:  Math.max(1, Math.round(caps.dailyInmails  * m)),
  };
}

export function skipToScheduleDay(key: string, schedule?: Partial<BrandSchedule> | null) {
  const hours = normalizeSchedule(schedule);
  let next = key;
  for (let i = 0; i < 8; i += 1) {
    if (hours.weekdays.includes(istanbulIsoWeekdayKey(next))) return next;
    next = addIstanbulDateKey(next, 1);
  }
  return next;
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
    dailyInmails: Math.min(brand.dailyInmails, ramp.dailyInmails),
  };
}

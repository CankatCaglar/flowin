"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FlaskConical,
  Gauge,
  Info,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Trash2,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { BrandAvatar } from "@/components/brands/BrandAvatar";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { useBrand } from "@/contexts/BrandContext";
import {
  DEFAULT_ALERTS,
  DEFAULT_PACING,
  DEFAULT_SCHEDULE,
  normalizeAlerts,
  normalizePacing,
  normalizeSchedule,
} from "@/lib/pacing";
import { linkedInProfileHref } from "@/lib/linkedin-profile";
import { cn, formatDateTime } from "@/lib/utils";
import type { BrandAlerts, BrandPacing, BrandSchedule } from "@/types";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const HOURS = Array.from({ length: 16 }, (_, index) => index + 7);

export default function SettingsPage() {
  const t = useTranslations("settings");
  const brandsT = useTranslations("brands");
  const { selectedBrand, editBrand } = useBrand();
  const locale = useLocale();
  const [pacing, setPacing] = useState<BrandPacing>(DEFAULT_PACING);
  const [schedule, setSchedule] = useState<BrandSchedule>(DEFAULT_SCHEDULE);
  const [alerts, setAlerts] = useState<BrandAlerts>(DEFAULT_ALERTS);
  const [savingPacing, setSavingPacing] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedBrand) return;
    setPacing(normalizePacing(selectedBrand.pacing));
    setSchedule(normalizeSchedule(selectedBrand.schedule));
    setAlerts(normalizeAlerts(selectedBrand.alerts));
  }, [selectedBrand]);

  if (!selectedBrand) return null;

  const outreachOn = selectedBrand.unipileStatus === "running";
  const linkedinHref = linkedInProfileHref(selectedBrand.linkedinPublicId ?? "");
  const lastSync = selectedBrand.unipileSyncedAt ?? (outreachOn ? selectedBrand.createdAt : undefined);
  const paused = Boolean(selectedBrand.outreachPaused);
  const testMode = Boolean(selectedBrand.testMode);
  const archived = Boolean(selectedBrand.archived);

  return (
    <div className="space-y-5">
      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        <article className="surface-card flex h-full flex-col rounded-2xl p-6">
          <CardTitle icon={UserRound} title={t("profile")} />
          <div className="mt-5 flex items-start gap-4">
            <BrandAvatar brand={selectedBrand} size="xl" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-ink">{selectedBrand.name}</p>
              {selectedBrand.linkedinEmail ? (
                <p className="mt-1 truncate text-sm text-muted">{selectedBrand.linkedinEmail}</p>
              ) : null}
              {selectedBrand.linkedinCompany ? (
                <p className="mt-1 truncate text-sm text-muted">{selectedBrand.linkedinCompany}</p>
              ) : null}
              {linkedinHref ? (
                <a
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-barney hover:underline"
                >
                  <LinkedInIcon className="h-3.5 w-3.5" />
                  {t("linkedinProfile")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-barney/50">
                  <LinkedInIcon className="h-3.5 w-3.5" />
                  {t("linkedinProfile")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </p>
              )}
            </div>
          </div>
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-barney" />
              {t("addedOnLabel")}
            </p>
            <p className="mt-1 pl-6 text-sm text-muted">
              {formatDateTime(selectedBrand.createdAt, locale)}
            </p>
          </div>
          <div className="mt-4 border-t border-purple-jam/10 pt-4">
            <p className="text-sm font-medium text-ink">{t("language")}</p>
            <div className="mt-2">
              <LanguageSwitcher />
            </div>
          </div>
        </article>

        <article className="surface-card flex h-full flex-col rounded-2xl p-6">
          <CardTitle icon={Link2} title={t("outreach")} />
          <span
            className={cn(
              "mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              outreachOn ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {outreachOn ? t("connected") : t("disconnected")}
          </span>
          <dl className="mt-4 divide-y divide-purple-jam/10">
            <StatusLine label={t("status")} value={outreachOn && !paused ? t("active") : t("inactive")} ok={outreachOn && !paused} />
            <StatusLine label={t("unipileStatus")} value={outreachOn ? t("active") : t("inactive")} ok={outreachOn} />
            <StatusLine
              label={t("lastSync")}
              value={lastSync ? formatDateTime(lastSync, locale) : t("lastSyncNone")}
            />
          </dl>
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <Button
              variant="light"
              className="w-full"
              onClick={() => {
                window.location.assign(
                  `/api/unipile/start?locale=${locale}&brand=${encodeURIComponent(selectedBrand.id)}`,
                );
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              {outreachOn ? t("reconnect") : brandsT("outreachConnect")}
            </Button>
            {outreachOn ? (
              <Button
                variant="light"
                disabled={busy}
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={async () => {
                  if (!window.confirm(t("disconnectConfirm"))) return;
                  setBusy(true);
                  try {
                    await editBrand(selectedBrand.id, { disconnectOutreach: true });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                {t("disconnectLinkedIn")}
              </Button>
            ) : null}
          </div>
        </article>

        <article className="surface-card flex h-full flex-col rounded-2xl p-6">
          <CardTitle icon={Gauge} title={t("pacing")} />
          <p className="mt-1.5 text-sm leading-5 text-muted">{t("pacingHint")}</p>
          <div className="mt-4 flex gap-2.5 rounded-xl bg-barney/5 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-barney" />
            <p className="text-[12px] leading-5 text-barney">{t("pacingWarn")}</p>
          </div>
          <div className="mt-5 grid min-w-0 grid-cols-4 gap-x-1.5 gap-y-4">
            <Stepper
              icon={UserPlus}
              label={t("dailyInvites")}
              value={pacing.dailyInvites}
              max={25}
              suffix={t("perDay")}
              onChange={(dailyInvites) => setPacing((current) => ({ ...current, dailyInvites }))}
            />
            <Stepper
              icon={MessageCircle}
              label={t("dailyMessages")}
              value={pacing.dailyMessages}
              max={40}
              suffix={t("perDay")}
              onChange={(dailyMessages) => setPacing((current) => ({ ...current, dailyMessages }))}
            />
            <Stepper
              icon={Eye}
              label={t("dailyViews")}
              value={pacing.dailyViews}
              max={40}
              suffix={t("perDay")}
              onChange={(dailyViews) => setPacing((current) => ({ ...current, dailyViews }))}
            />
            <Stepper
              icon={Mail}
              label={t("dailyInmails")}
              value={pacing.dailyInmails}
              max={15}
              suffix={t("perDay")}
              onChange={(dailyInmails) => setPacing((current) => ({ ...current, dailyInmails }))}
            />
          </div>
          <div className="mt-auto flex justify-end pt-5">
            <Button
              disabled={savingPacing}
              onClick={async () => {
                setSavingPacing(true);
                try {
                  const next = normalizePacing(pacing);
                  await editBrand(selectedBrand.id, { pacing: next });
                  setPacing(next);
                } finally {
                  setSavingPacing(false);
                }
              }}
            >
              {t("savePacing")}
            </Button>
          </div>
        </article>
      </div>

      <article className="surface-card rounded-2xl p-6">
        <CardTitle icon={Clock} title={t("hours")} />
        <p className="mt-2 text-sm leading-6 text-muted">{t("hoursHint")}</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-end">
          <div className="grid w-full shrink-0 grid-cols-2 gap-3 lg:w-72">
            <HourSelect
              id="hours-start"
              label={t("hoursStart")}
              value={schedule.startHour}
              onChange={(startHour) => setSchedule((current) => ({ ...current, startHour }))}
            />
            <HourSelect
              id="hours-end"
              label={t("hoursEnd")}
              value={schedule.endHour}
              onChange={(endHour) => setSchedule((current) => ({ ...current, endHour }))}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-muted">{t("workdays")}</p>
            <div className="mt-2 flex flex-nowrap items-center gap-2">
              {WEEKDAYS.map((day) => {
                const on = schedule.weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setSchedule((current) => ({
                        ...current,
                        weekdays: on
                          ? current.weekdays.filter((item) => item !== day)
                          : [...current.weekdays, day].sort((a, b) => a - b),
                      }))
                    }
                    className={cn(
                      "inline-flex min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold",
                      on ? "bg-barney text-white" : "border border-purple-jam/15 bg-white text-ink",
                    )}
                  >
                    {t(`weekday${day}`)}
                    {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                  </button>
                );
              })}
              <Button
                className="ml-auto shrink-0"
                disabled={savingHours}
                onClick={async () => {
                  setSavingHours(true);
                  try {
                    const next = normalizeSchedule(schedule);
                    await editBrand(selectedBrand.id, { schedule: next });
                    setSchedule(next);
                  } finally {
                    setSavingHours(false);
                  }
                }}
              >
                {t("saveHours")}
              </Button>
            </div>
          </div>
        </div>
      </article>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <article className="surface-card rounded-2xl p-6">
          <CardTitle icon={FlaskConical} title={t("testOps")} />
          <div className="mt-5 space-y-4">
            <ToggleRow
              title={t("testMode")}
              hint={t("testModeHint")}
              on={testMode}
              disabled={busy}
              onToggle={async () => {
                setBusy(true);
                try {
                  await editBrand(selectedBrand.id, { testMode: !testMode });
                } finally {
                  setBusy(false);
                }
              }}
            />
            <ToggleRow
              title={t("pauseAll")}
              hint={t("pauseAllHint")}
              on={paused}
              disabled={busy}
              onToggle={async () => {
                setBusy(true);
                try {
                  await editBrand(selectedBrand.id, { outreachPaused: !paused });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
        </article>

        <article className="surface-card rounded-2xl p-6">
          <CardTitle icon={Bell} title={t("alerts")} />
          <div className="mt-5 space-y-4">
            {(
              [
                ["connectionLost", t("alertConnection")],
                ["sendFailed", t("alertFailed")],
                ["lowLeads", t("alertLowLeads")],
                ["dailyCap", t("alertDailyCap")],
              ] as const
            ).map(([key, label]) => (
              <ToggleRow
                key={key}
                title={label}
                on={alerts[key]}
                disabled={busy}
                onToggle={async () => {
                  const next = { ...alerts, [key]: !alerts[key] };
                  setAlerts(next);
                  setBusy(true);
                  try {
                    await editBrand(selectedBrand.id, { alerts: next });
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))}
          </div>
        </article>
      </div>

      <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div>
            <h2 className="text-base font-semibold text-rose-900">{t("archive")}</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800/80">{t("archiveHint")}</p>
          </div>
        </div>
        <Button
          variant="light"
          disabled={busy}
          className="border-rose-300 text-rose-700 hover:bg-rose-100"
          onClick={async () => {
            if (!archived && !window.confirm(t("archiveConfirm"))) return;
            setBusy(true);
            try {
              await editBrand(selectedBrand.id, { archived: !archived });
            } finally {
              setBusy(false);
            }
          }}
        >
          {archived ? t("unarchive") : t("archive")}
        </Button>
      </article>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <Lock className="h-3.5 w-3.5" />
        {t("adminOnly")}
      </p>
    </div>
  );
}

function CardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
      <Icon className="h-4 w-4 text-barney" />
      {title}
    </h2>
  );
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("font-semibold", ok ? "text-emerald-700" : "text-ink")}>{value}</span>
    </div>
  );
}

function ToggleRow({
  title,
  hint,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-barney" : "bg-purple-jam/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            on ? "left-5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function Stepper({
  icon: Icon,
  label,
  value,
  max,
  suffix,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
      <p className="mt-1.5 min-h-8 w-full text-[11px] font-medium leading-4 wrap-break-word text-ink">
        {label}
      </p>
      <div className="mt-2 flex min-w-0 flex-nowrap items-center justify-center gap-0.5">
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.min(max, Math.max(1, Math.round(next))));
          }}
          className="h-8 w-10 shrink-0 rounded-lg border border-purple-jam/15 bg-white text-center font-display text-sm font-semibold text-ink outline-none focus:border-barney/40"
        />
        <span className="text-[11px] text-muted">{suffix}</span>
      </div>
    </div>
  );
}

function HourSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative min-w-0 space-y-2" ref={ref}>
      <span className="text-[13px] font-medium text-muted" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        id={id}
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border bg-white px-3 text-left font-display text-sm font-semibold text-ink outline-none",
          open ? "border-barney/40" : "border-purple-jam/15 hover:border-barney/30",
        )}
      >
        {String(value).padStart(2, "0")}:00
        <Clock className="h-4 w-4 text-muted" strokeWidth={1.75} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-purple-jam/15 bg-white p-1 shadow-[0_12px_32px_rgba(42,16,47,0.12)]"
        >
          {HOURS.map((hour) => {
            const selected = hour === value;
            return (
              <li key={hour}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2 text-left font-display text-sm font-semibold",
                    selected ? "bg-barney text-white" : "text-ink hover:bg-barney/5",
                  )}
                  onClick={() => {
                    onChange(hour);
                    setOpen(false);
                  }}
                >
                  {String(hour).padStart(2, "0")}:00
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

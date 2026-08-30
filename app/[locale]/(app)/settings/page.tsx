"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useBrand } from "@/contexts/BrandContext";
import { BrandAvatar } from "@/components/brands/BrandAvatar";
import { DEFAULT_PACING, normalizePacing } from "@/lib/pacing";
import { formatDate } from "@/lib/utils";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const brandsT = useTranslations("brands");
  const { selectedBrand, editBrand } = useBrand();
  const locale = useLocale();
  const [draft, setDraft] = useState({
    dailyInvites: String(DEFAULT_PACING.dailyInvites),
    dailyMessages: String(DEFAULT_PACING.dailyMessages),
    dailyViews: String(DEFAULT_PACING.dailyViews),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedBrand) return;
    const next = normalizePacing(selectedBrand.pacing);
    setDraft({
      dailyInvites: String(next.dailyInvites),
      dailyMessages: String(next.dailyMessages),
      dailyViews: String(next.dailyViews),
    });
  }, [selectedBrand]);

  if (!selectedBrand) return null;

  const outreachOn = selectedBrand.unipileStatus === "running";

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <article className="surface-card flex h-full flex-col rounded-2xl p-6">
          <h2 className="text-base font-semibold text-ink">{t("brand")}</h2>
          <div className="mt-5 flex items-center gap-4">
            <BrandAvatar brand={selectedBrand} size="md" />
            <div>
              <p className="text-xs text-muted">{t("brandName")}</p>
              <p className="text-lg font-semibold text-ink">{selectedBrand.name}</p>
              {selectedBrand.linkedinEmail ? (
                <>
                  <p className="mt-2 text-xs text-muted">{t("linkedinEmail")}</p>
                  <p className="text-sm text-ink">{selectedBrand.linkedinEmail}</p>
                </>
              ) : null}
            </div>
          </div>
          <p className="mt-5 text-sm text-muted">
            {t("createdAt")}: {formatDate(selectedBrand.createdAt, locale)}
          </p>
          <div className="mt-5 rounded-xl border border-purple-jam/15 bg-white/40 p-4">
            <p className="text-sm font-medium text-ink">{t("outreach")}</p>
            <p className="mt-1 text-sm text-muted">
              {outreachOn ? t("outreachOn") : t("outreachOff")}
            </p>
            <Button
              className="mt-3"
              variant="brand"
              onClick={() => {
                window.location.assign(
                  `/api/unipile/start?locale=${locale}&brand=${encodeURIComponent(selectedBrand.id)}`,
                );
              }}
            >
              {outreachOn ? brandsT("outreachReconnect") : brandsT("outreachConnect")}
            </Button>
          </div>
        </article>
        <article className="surface-card flex h-full flex-col rounded-2xl p-6">
          <h2 className="text-base font-semibold text-ink">{t("language")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("languageHint")}</p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
          <div className="mt-5">
            <h3 className="text-base font-semibold text-ink">{t("pacing")}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{t("pacingHint")}</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <PacingField
                id="daily-invites"
                label={t("dailyInvites")}
                value={draft.dailyInvites}
                onChange={(value) => setDraft((current) => ({ ...current, dailyInvites: value }))}
              />
              <PacingField
                id="daily-messages"
                label={t("dailyMessages")}
                value={draft.dailyMessages}
                onChange={(value) => setDraft((current) => ({ ...current, dailyMessages: value }))}
              />
              <PacingField
                id="daily-views"
                label={t("dailyViews")}
                value={draft.dailyViews}
                onChange={(value) => setDraft((current) => ({ ...current, dailyViews: value }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {saved ? <p className="text-sm text-barney">{t("pacingSaved")}</p> : null}
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaved(false);
                  try {
                    const pacing = normalizePacing({
                      dailyInvites: Number(draft.dailyInvites),
                      dailyMessages: Number(draft.dailyMessages),
                      dailyViews: Number(draft.dailyViews),
                    });
                    await editBrand(selectedBrand.id, { pacing });
                    setDraft({
                      dailyInvites: String(pacing.dailyInvites),
                      dailyMessages: String(pacing.dailyMessages),
                      dailyViews: String(pacing.dailyViews),
                    });
                    setSaved(true);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {t("savePacing")}
              </Button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function PacingField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      id={id}
      variant="light"
      inputMode="numeric"
      autoComplete="off"
      label={label}
      labelClassName="leading-5"
      value={value}
      onChange={(event) => onChange(digitsOnly(event.target.value))}
    />
  );
}

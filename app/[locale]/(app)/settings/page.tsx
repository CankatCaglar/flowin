"use client";

import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { brandInitial, formatDate } from "@/lib/utils";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { selectedBrand } = useBrand();
  const locale = useLocale();

  if (!selectedBrand) return null;

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="surface-card rounded-2xl p-6">
          <h2 className="text-base font-semibold text-ink">{t("brand")}</h2>
          <div className="mt-5 flex items-center gap-4">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{
                background: `linear-gradient(145deg, ${selectedBrand.avatarColor}, #AE1BB6)`,
              }}
            >
              {brandInitial(selectedBrand.name)}
            </span>
            <div>
              <p className="text-xs text-muted">{t("brandName")}</p>
              <p className="text-lg font-semibold text-ink">{selectedBrand.name}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted">
            {t("createdAt")}: {formatDate(selectedBrand.createdAt, locale)}
          </p>
        </article>
        <article className="surface-card rounded-2xl p-6">
          <h2 className="text-base font-semibold text-ink">{t("language")}</h2>
          <p className="mt-2 text-sm text-muted">{t("languageHint")}</p>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </article>
      </div>
    </div>
  );
}

"use client";

import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/utils";

export function CreateCampaignSidebar({
  leadCount,
  sourceLabel,
}: {
  leadCount: number;
  sourceLabel: string;
}) {
  const t = useTranslations("campaigns.create");
  const locale = useLocale();

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4">
      <section className="surface-card rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold text-ink">{t("summary")}</h2>
        <ul className="mt-4 space-y-4">
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-muted">
              <Users className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm text-muted">{t("summaryLeads")}</span>
            <span className="font-display text-sm font-semibold text-ink">
              {formatNumber(leadCount, locale)}
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm leading-6 text-muted">{sourceLabel}</p>
        <p className="mt-3 text-xs leading-5 text-muted">{t("fixedFlowHint")}</p>
      </section>
    </aside>
  );
}

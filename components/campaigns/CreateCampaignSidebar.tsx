"use client";

import { Clock3, GitBranch, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CreateFlowPreview } from "@/components/campaigns/CreateCampaignFlow";
import { flowDurationHours } from "@/lib/campaign-flow";
import { formatNumber } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

export function CreateCampaignSidebar({
  leadCount,
  steps,
  sourceLabel,
}: {
  leadCount: number;
  steps: CampaignFlowStep[];
  sourceLabel: string;
}) {
  const t = useTranslations("campaigns.create");
  const locale = useLocale();
  const hours = flowDurationHours(steps);
  const durationLabel =
    hours > 0 && hours < 24
      ? t("durationHours", { count: hours })
      : t("durationDays", { count: Math.round((hours / 24) * 10) / 10 });

  const items = [
    {
      icon: Users,
      label: t("summaryLeads"),
      value: formatNumber(leadCount, locale),
    },
    {
      icon: GitBranch,
      label: t("summarySteps"),
      value: formatNumber(steps.length, locale),
    },
    {
      icon: Clock3,
      label: t("summaryDuration"),
      value: durationLabel,
    },
  ];

  return (
    <aside className="contents">
      <section className="surface-card rounded-2xl p-5 xl:col-start-2 xl:row-start-1">
        <h2 className="font-display text-base font-semibold leading-snug text-ink">{t("summary")}</h2>
        <ul className="mt-4 space-y-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted">{item.label}</span>
                <span className="font-display text-sm font-semibold text-ink">{item.value}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm leading-6 text-muted">{sourceLabel}</p>
      </section>
      <section className="surface-card flex h-full min-h-0 flex-col rounded-2xl p-5 xl:col-start-2 xl:row-start-2">
        <h2 className="mb-5 shrink-0 py-0.5 font-sans text-base font-semibold leading-normal text-ink">
          {t("preview")}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto pt-0.5">
          <CreateFlowPreview steps={steps} />
        </div>
      </section>
    </aside>
  );
}

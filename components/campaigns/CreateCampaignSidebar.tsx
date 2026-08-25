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
}: {
  leadCount: number;
  steps: CampaignFlowStep[];
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
    <aside className="flex h-full min-h-0 flex-col gap-4">
      <section className="surface-card shrink-0 rounded-2xl p-5">
        <h2 className="font-display text-base font-semibold text-ink">{t("summary")}</h2>
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
      </section>
      <section className="surface-card flex min-h-0 flex-1 flex-col rounded-2xl p-5">
        <h2 className="mb-5 shrink-0 font-display text-base font-semibold text-ink">
          {t("preview")}
        </h2>
        <div className="min-h-0 flex-1">
          <CreateFlowPreview steps={steps} />
        </div>
      </section>
    </aside>
  );
}

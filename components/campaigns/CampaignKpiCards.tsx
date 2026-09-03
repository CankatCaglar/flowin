"use client";

import { MessageCircle, Send, TrendingUp, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EMPTY_METRIC, formatNumber, formatPercent } from "@/lib/utils";

export function CampaignKpiCards({
  leadGoal,
  delivered,
  replied,
  success,
  hasSends,
}: {
  leadGoal: number;
  delivered: number;
  replied: number;
  success: number;
  hasSends: boolean;
}) {
  const t = useTranslations("campaigns.overview");
  const locale = useLocale();
  const cards = [
    { title: t("leadGoal"), value: formatNumber(leadGoal, locale), icon: Users },
    { title: t("delivered"), value: formatNumber(delivered, locale), icon: Send },
    { title: t("responded"), value: formatNumber(replied, locale), icon: MessageCircle },
    {
      title: t("success"),
      value: hasSends ? formatPercent(success, locale) : EMPTY_METRIC,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.title} className="surface-card rounded-2xl p-5">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Icon className="h-4 w-4 text-barney" />
              {card.title}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              {card.value}
            </p>
          </article>
        );
      })}
    </div>
  );
}

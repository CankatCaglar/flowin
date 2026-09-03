"use client";

import { ArrowDownRight, ArrowUpRight, Rocket, Send, Target, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber, formatPercent, EMPTY_METRIC } from "@/lib/utils";

interface KpiCardsProps {
  activeCampaigns: number;
  sentCount: number;
  connectionCount: number;
  successRate: number;
  sentTrend: number;
  connectionTrend: number;
}

function TrendHint({ value }: { value: number }) {
  const t = useTranslations("dashboard.metrics");
  const locale = useLocale();
  const up = value > 0;
  const down = value < 0;
  const Arrow = down ? ArrowDownRight : ArrowUpRight;
  const tone = up ? "text-emerald-600" : down ? "text-red-500" : "text-muted";

  return (
    <p className="mt-2 flex items-center gap-1 text-[11px] sm:mt-4 sm:text-xs">
      {value !== 0 ? <Arrow className={`h-3.5 w-3.5 ${tone}`} /> : null}
      <span className={`font-medium ${tone}`}>
        {formatPercent(Math.abs(value), locale)}
      </span>
      <span className="text-muted">{t("vsLastPeriodHint")}</span>
    </p>
  );
}

export function KpiCards(props: KpiCardsProps) {
  const t = useTranslations("dashboard.metrics");
  const locale = useLocale();

  const cards = [
    {
      title: t("activeCampaigns"),
      value: formatNumber(props.activeCampaigns, locale),
      hint: t("activeCampaignsHint"),
      icon: Rocket,
      iconClass: "text-barney",
    },
    {
      title: t("sentMessages"),
      value: formatNumber(props.sentCount, locale),
      trend: props.sentTrend,
      icon: Send,
      iconClass: "text-emerald-600",
    },
    {
      title: t("newConnections"),
      value: formatNumber(props.connectionCount, locale),
      trend: props.connectionTrend,
      icon: Users,
      iconClass: "text-sky-600",
    },
    {
      title: t("successRate"),
      value: props.sentCount > 0 ? formatPercent(props.successRate, locale) : EMPTY_METRIC,
      hint: t("successRateHint"),
      icon: Target,
      iconClass: "text-barney",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.title} className="surface-card rounded-2xl p-3.5 sm:p-5">
            <p className="flex items-center gap-1.5 text-xs text-muted sm:gap-2 sm:text-sm">
              <Icon className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${card.iconClass}`} />
              <span className="truncate">{card.title}</span>
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-3xl">
              {card.value}
            </p>
            {"trend" in card && card.trend !== undefined ? (
              <TrendHint value={card.trend} />
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-muted sm:mt-4 sm:text-xs">{card.hint}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

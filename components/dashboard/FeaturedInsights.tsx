"use client";

import { ChevronRight, Clock3, MessageCircle, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDecimal, formatNumber, formatPercent, successRate } from "@/lib/utils";
import type { Campaign } from "@/types";

export function FeaturedInsights({
  best,
  mostReplied,
  averageReplyDays,
}: {
  best?: Campaign;
  mostReplied?: Campaign;
  averageReplyDays: number;
}) {
  const t = useTranslations("dashboard.insights");
  const common = useTranslations("common");
  const locale = useLocale();

  const items = [
    {
      href: "/campaigns",
      title: t("bestCampaign"),
      subtitle: best?.name ?? t("empty"),
      value: best
        ? formatPercent(successRate(best.sentCount, best.repliedCount), locale)
        : "—",
      valueLabel: t("successLabel"),
      icon: Trophy,
      iconClass: "text-barney",
    },
    {
      href: "/campaigns",
      title: t("mostReplies"),
      subtitle: mostReplied?.name ?? t("empty"),
      value: mostReplied ? formatNumber(mostReplied.repliedCount, locale) : "—",
      valueLabel: t("repliesLabel"),
      icon: MessageCircle,
      iconClass: "text-emerald-600",
    },
    {
      href: "/messages",
      title: t("avgReply"),
      subtitle: undefined,
      value: formatDecimal(averageReplyDays, locale),
      valueLabel: common("days"),
      icon: Clock3,
      iconClass: "text-sky-600",
    },
  ];

  return (
    <article className="surface-card flex h-full flex-col rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{t("title")}</h2>
      <div className="mt-4 flex flex-1 flex-col justify-center space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-purple-jam/10 bg-white px-3 py-3"
            >
              <Icon className={`h-4 w-4 shrink-0 ${item.iconClass}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{item.title}</span>
                {item.subtitle ? (
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-ink">{item.value}</span>
                <span className="mt-0.5 block text-xs text-muted">{item.valueLabel}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          );
        })}
      </div>
    </article>
  );
}

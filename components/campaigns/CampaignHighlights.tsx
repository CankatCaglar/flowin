import { Calendar, Clock3, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { flowStepTitle } from "@/lib/campaign-flow";
import { parseDateKey } from "@/lib/dates";
import { EMPTY_METRIC, formatDurationShort, formatPercent } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

export function CampaignHighlights({
  bestDayKey,
  bestDayRate,
  topStep,
  topStepRate,
  averageReplyDays,
}: {
  bestDayKey?: string;
  bestDayRate?: number;
  topStep?: CampaignFlowStep;
  topStepRate?: number;
  averageReplyDays: number | null;
}) {
  const t = useTranslations("campaigns.overview");
  const locale = useLocale();
  const weekday = bestDayKey
    ? new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        weekday: "long",
      }).format(parseDateKey(bestDayKey))
    : EMPTY_METRIC;

  const items = [
    {
      title: t("bestDay"),
      value: weekday,
      hint:
        bestDayKey && bestDayRate != null
          ? t("bestDayHint", { rate: formatPercent(bestDayRate, locale) })
          : undefined,
      icon: Calendar,
    },
    {
      title: t("topStep"),
      value: topStep ? flowStepTitle(topStep, locale) : EMPTY_METRIC,
      hint:
        topStep && topStepRate != null
          ? t("topStepHint", { rate: formatPercent(topStepRate, locale) })
          : undefined,
      icon: MessageCircle,
    },
    {
      title: t("avgReply"),
      value:
        averageReplyDays == null ? EMPTY_METRIC : formatDurationShort(averageReplyDays, locale),
      hint: t("avgReplyHint"),
      icon: Clock3,
    },
  ];

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-ink">{t("highlights")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="surface-card rounded-2xl p-5">
              <p className="flex items-center gap-2 text-sm text-muted">
                <Icon className="h-4 w-4 text-barney" />
                {item.title}
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-ink">{item.value}</p>
              {item.hint ? <p className="mt-1 text-xs text-muted">{item.hint}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

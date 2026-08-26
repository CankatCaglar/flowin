import { Calendar, Clock3, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { flowStepTitle } from "@/lib/campaign-flow";
import { parseDateKey } from "@/lib/dates";
import { formatDurationShort, formatPercent } from "@/lib/utils";
import type { CampaignFlowStep } from "@/types";

export function CampaignHighlights({
  bestDayKey,
  bestDayRate,
  topStep,
  topStepRate,
  averageReplyDays,
}: {
  bestDayKey?: string;
  bestDayRate: number;
  topStep?: CampaignFlowStep;
  topStepRate: number;
  averageReplyDays: number;
}) {
  const t = useTranslations("campaigns.overview");
  const locale = useLocale();
  const weekday = bestDayKey
    ? new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        weekday: "long",
      }).format(parseDateKey(bestDayKey))
    : "—";

  const items = [
    {
      title: t("bestDay"),
      value: weekday,
      hint: t("bestDayHint", { rate: formatPercent(bestDayRate, locale) }),
      icon: Calendar,
    },
    {
      title: t("topStep"),
      value: topStep ? flowStepTitle(topStep, locale) : "—",
      hint: t("topStepHint", { rate: formatPercent(topStepRate, locale) }),
      icon: MessageCircle,
    },
    {
      title: t("avgReply"),
      value: formatDurationShort(averageReplyDays, locale),
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
              <p className="mt-1 text-xs text-muted">{item.hint}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

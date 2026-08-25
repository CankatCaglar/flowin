import { useLocale, useTranslations } from "next-intl";
import { flowStepCounts } from "@/lib/campaign-flow";
import { cn, formatNumber } from "@/lib/utils";
import type { Campaign } from "@/types";

export function CampaignFlowSummary({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.overview");
  const locale = useLocale();
  const counts = flowStepCounts(campaign.sentCount, campaign.flow.length);
  const inset = `${100 / (Math.max(campaign.flow.length, 1) * 2)}%`;

  return (
    <article className="surface-card flex h-full min-h-0 flex-col rounded-2xl p-5">
      <h2 className="shrink-0 font-display text-base font-semibold text-ink">Flow</h2>
      <ol className="relative mt-3 flex min-h-0 flex-1 flex-col">
        <span
          aria-hidden
          className="pointer-events-none absolute left-[15px] z-0 border-l border-dashed border-barney/30"
          style={{ top: inset, bottom: inset }}
        />
        {campaign.flow.map((step, index) => (
          <li key={step.id} className="relative flex min-h-0 flex-1 items-center gap-3">
            {index > 0 ? (
              <span
                aria-hidden
                className="absolute inset-x-0 left-10 top-0 border-t border-purple-jam/10"
              />
            ) : null}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-barney font-display text-xs font-semibold text-white">
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{step.title}</p>
            <p className="shrink-0 text-sm">
              <span className="font-display font-semibold text-ink">
                {formatNumber(counts[index] ?? 0, locale)}
              </span>{" "}
              <span className={cn("text-muted")}>{t("leadCount")}</span>
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}

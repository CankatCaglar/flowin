import { Calendar, Clock3, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/utils";
import type { Campaign } from "@/types";

export function CampaignInfoBar({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.overview");
  const locale = useLocale();
  const items = [
    { label: t("start"), value: formatDate(campaign.startDate, locale), icon: Calendar },
    { label: t("end"), value: formatDate(campaign.endDate, locale), icon: Calendar },
    { label: t("audience"), value: campaign.targetAudience, icon: Users },
    { label: t("created"), value: formatDate(campaign.createdAt, locale), icon: Clock3 },
  ];

  return (
    <article className="surface-card grid gap-4 rounded-2xl p-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-start gap-3">
            <span className="mt-0.5 text-barney">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          </div>
        );
      })}
    </article>
  );
}

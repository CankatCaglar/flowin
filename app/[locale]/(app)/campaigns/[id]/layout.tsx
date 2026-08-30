"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { CampaignDetailHeader } from "@/components/campaigns/CampaignDetailHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { Link } from "@/i18n/navigation";

export default function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("campaigns");
  const common = useTranslations("common");
  const { selectedBrand } = useBrand();
  const { campaigns, loading, refresh } = useBrandData(selectedBrand?.id ?? null);
  const campaign = campaigns.find((item) => item.id === id);

  if (loading) {
    return <p className="text-sm text-muted">{common("loading")}</p>;
  }

  if (!campaign) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("notFound")}</p>
        <Link href="/campaigns" className="text-sm font-medium text-barney">
          {t("backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <CampaignDetailHeader campaign={campaign} onChanged={refresh} />
      {children}
    </div>
  );
}

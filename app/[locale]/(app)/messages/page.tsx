"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessagesWorkspace } from "@/components/messages/MessagesWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useBrand } from "@/contexts/BrandContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useBrandData } from "@/hooks/useBrandData";

export default function MessagesPage() {
  const common = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted">{common("loading")}</p>}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const t = useTranslations("messages");
  const searchParams = useSearchParams();
  const { selectedBrand } = useBrand();
  const { now } = useDateRange();
  const { messages, leads, campaigns, loading, refresh } = useBrandData(selectedBrand?.id ?? null);
  const awaitingOurs = searchParams.get("awaiting") === "ours";
  const campaignParam = searchParams.get("campaign");
  const initialCampaignId =
    campaignParam && campaigns.some((campaign) => campaign.id === campaignParam)
      ? campaignParam
      : "all";
  const initialFilter = awaitingOurs ? "ours" : "all";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
      </div>
      {loading && messages.length === 0 ? (
        <PageSkeleton rows={6} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessagesWorkspace
            key={`${initialFilter}-${initialCampaignId}`}
            brandId={selectedBrand?.id ?? ""}
            messages={messages}
            leads={leads}
            campaigns={campaigns}
            now={now}
            onSent={refresh}
            initialCampaignId={initialCampaignId}
            initialFilter={initialFilter}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { LEAD_STATUSES } from "@/lib/leads";
import type { LeadStatus } from "@/types";

function resolveStatus(params: URLSearchParams): LeadStatus | "all" {
  const status = params.get("status");
  if (status && LEAD_STATUSES.includes(status as LeadStatus)) {
    return status as LeadStatus;
  }
  const filter = params.get("filter");
  if (filter === "unresponsive") return "waiting_reply";
  if (filter === "in_progress") return "queued";
  return "all";
}

export default function LeadsPage() {
  const common = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted">{common("loading")}</p>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const t = useTranslations("leads");
  const searchParams = useSearchParams();
  const { selectedBrand } = useBrand();
  const { campaigns, leads } = useBrandData(selectedBrand?.id ?? null);
  const initialStatus = resolveStatus(searchParams);
  const campaignParam = searchParams.get("campaign");
  const initialCampaignId =
    campaignParam && campaigns.some((campaign) => campaign.id === campaignParam)
      ? campaignParam
      : "all";

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <LeadsWorkspace
        key={`${initialStatus}-${initialCampaignId}`}
        leads={leads}
        campaigns={campaigns}
        showCampaign
        initialCampaignId={initialCampaignId}
        initialStatus={initialStatus}
      />
    </div>
  );
}

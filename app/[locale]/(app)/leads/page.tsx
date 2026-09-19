"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { LEAD_STAGES, LEAD_STATUSES } from "@/lib/leads";
import type { LeadStage, LeadStatus } from "@/types";

function resolveStatus(params: URLSearchParams): LeadStatus | "all" {
  const status = params.get("status");
  if (status === "failed") return "all";
  if (status && LEAD_STATUSES.includes(status as LeadStatus)) {
    return status as LeadStatus;
  }
  const filter = params.get("filter");
  if (filter === "unresponsive") return "waiting_reply";
  if (filter === "in_progress") return "queued";
  return "all";
}

function resolveStage(params: URLSearchParams): LeadStage | "campaign_ended" | "all" {
  const stage = params.get("stage");
  if (stage === "campaign_ended") return "campaign_ended";
  if (stage && LEAD_STAGES.includes(stage as LeadStage)) {
    return stage as LeadStage;
  }
  if (params.get("status") === "failed") return "failed";
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
  const { campaigns, leads, messages } = useBrandData(selectedBrand?.id ?? null);
  const awaitingOurs =
    searchParams.get("awaiting") === "ours" || searchParams.get("awaiting") === "reply";
  const initialLeadId = searchParams.get("lead")?.trim() ?? "";
  const initialStage = awaitingOurs ? "all" : resolveStage(searchParams);
  const initialStatus = awaitingOurs ? "all" : resolveStatus(searchParams);
  const campaignParam = searchParams.get("campaign");
  const initialCampaignId =
    campaignParam && campaigns.some((campaign) => campaign.id === campaignParam)
      ? campaignParam
      : "all";

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <LeadsWorkspace
        key={`${initialStage}-${initialStatus}-${initialCampaignId}-${searchParams.get("awaiting") ?? ""}-${initialLeadId}`}
        leads={leads}
        campaigns={campaigns}
        messages={messages}
        showCampaign
        initialCampaignId={initialCampaignId}
        initialStage={initialStage}
        initialStatus={initialStatus}
        replyWaitOnly={awaitingOurs}
        initialLeadId={initialLeadId}
      />
    </div>
  );
}

"use client";

import { use } from "react";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { createLead } from "@/lib/outreach-api";

export default function CampaignLeadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedBrand } = useBrand();
  const { campaigns, leads, refresh } = useBrandData(selectedBrand?.id ?? null);
  const campaignLeads = leads.filter((lead) => lead.campaignId === id);

  return (
    <LeadsWorkspace
      leads={campaignLeads}
      campaigns={campaigns}
      onAddLead={
        selectedBrand
          ? async (input) => {
              const lead = await createLead({
                brandId: selectedBrand.id,
                campaignId: id,
                ...input,
              });
              refresh();
              return lead;
            }
          : undefined
      }
    />
  );
}

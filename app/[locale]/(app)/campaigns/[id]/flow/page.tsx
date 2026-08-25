"use client";

import { use, useState } from "react";
import { CampaignFlowEditor } from "@/components/campaigns/CampaignFlowEditor";
import { EditFlowStepModal } from "@/components/campaigns/EditFlowStepModal";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { updateCampaign } from "@/lib/data";
import { defaultCampaignFlow } from "@/lib/campaign-flow";
import type { CampaignFlowStep } from "@/types";

export default function CampaignFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedBrand } = useBrand();
  const { campaigns, refresh } = useBrandData(selectedBrand?.id ?? null);
  const campaign = campaigns.find((item) => item.id === id);
  const [localFlow, setLocalFlow] = useState<CampaignFlowStep[] | null>(null);
  const [editing, setEditing] = useState<CampaignFlowStep | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!campaign) return null;
  const steps = localFlow ?? campaign.flow ?? defaultCampaignFlow();
  const activeId = editing?.id ?? selectedId ?? steps[1]?.id ?? steps[0]?.id;

  return (
    <div className="max-w-xl">
      <CampaignFlowEditor
        steps={steps}
        selectedId={activeId}
        onSelect={(step) => {
          setSelectedId(step.id);
          setEditing(step);
        }}
      />
      {editing ? (
        <EditFlowStepModal
          key={editing.id}
          step={editing}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const flow = steps.map((step) => (step.id === next.id ? next : step));
            setLocalFlow(flow);
            await updateCampaign(campaign.id, { flow });
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

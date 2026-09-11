"use client";

import { useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CampaignStatusConfirm,
  type CampaignStatusAction,
} from "@/components/campaigns/CampaignStatusConfirm";
import { AnchoredMenu, selectOptionClass } from "@/components/ui/SelectMenu";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { useSharedBrandData } from "@/contexts/BrandDataContext";
import { useRouter } from "@/i18n/navigation";
import { isCampaignRunning } from "@/lib/campaign-status";
import { updateCampaign } from "@/lib/outreach-api";
import type { Campaign, CampaignStatus } from "@/types";

export function CampaignRowMenu({
  campaign,
  onChanged,
}: {
  campaign: Campaign;
  onChanged?: () => void;
}) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const { open, toggle, close } = useMenu(`campaign-row-${campaign.id}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { patchCampaign, refresh } = useSharedBrandData();
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<CampaignStatusAction | null>(null);
  useDismissable([rootRef, panelRef], open, close);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const setStatus = async (status: CampaignStatus) => {
    if (saving) return;
    const previous = campaign.status;
    setSaving(true);
    close();
    patchCampaign(campaign.id, { status });
    try {
      const next = await updateCampaign(campaign.id, { status });
      patchCampaign(campaign.id, { status: next.status });
      onChanged?.();
    } catch {
      patchCampaign(campaign.id, { status: previous });
      refresh();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        aria-label={t("rowActions")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnchoredMenu open={open} anchorRef={rootRef} align="right" panelRef={panelRef} className="w-48">
        <button type="button" className={selectOptionClass(false)} onClick={() => go(`/campaigns/${campaign.id}`)}>
          {t("openCampaign")}
        </button>
        <button
          type="button"
          className={selectOptionClass(false)}
          onClick={() => go(`/campaigns/${campaign.id}/flow`)}
        >
          {t("tabs.flow")}
        </button>
        {isCampaignRunning(campaign.status) ? (
          <button
            type="button"
            className={selectOptionClass(false)}
            onClick={() => {
              close();
              setPending("paused");
            }}
          >
            {t("pauseCampaign")}
          </button>
        ) : null}
        {campaign.status === "paused" || campaign.status === "draft" ? (
          <button
            type="button"
            className={selectOptionClass(false)}
            onClick={() => {
              close();
              setPending("active");
            }}
          >
            {t("resumeCampaign")}
          </button>
        ) : null}
        {campaign.status !== "completed" ? (
          <button
            type="button"
            className={selectOptionClass(false)}
            onClick={() => {
              close();
              setPending("completed");
            }}
          >
            {t("completeCampaign")}
          </button>
        ) : null}
      </AnchoredMenu>
      <CampaignStatusConfirm
        action={pending}
        campaignName={campaign.name}
        saving={saving}
        onClose={() => setPending(null)}
        onConfirm={(status) => {
          setPending(null);
          void setStatus(status);
        }}
      />
    </div>
  );
}

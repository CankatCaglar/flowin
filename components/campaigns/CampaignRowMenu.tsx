"use client";

import { useRef } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnchoredMenu, selectOptionClass } from "@/components/ui/SelectMenu";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { useRouter } from "@/i18n/navigation";

export function CampaignRowMenu({ campaignId }: { campaignId: string }) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const { open, toggle, close } = useMenu(`campaign-row-${campaignId}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);

  const go = (href: string) => {
    close();
    router.push(href);
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
      <AnchoredMenu open={open} anchorRef={rootRef} align="right" panelRef={panelRef} className="w-44">
        <button type="button" className={selectOptionClass(false)} onClick={() => go(`/campaigns/${campaignId}`)}>
          {t("openCampaign")}
        </button>
        <button
          type="button"
          className={selectOptionClass(false)}
          onClick={() => go(`/campaigns/${campaignId}/flow`)}
        >
          {t("tabs.flow")}
        </button>
      </AnchoredMenu>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CampaignStatus } from "@/types";

export type CampaignStatusAction = "paused" | "active" | "completed";

export function CampaignStatusConfirm({
  action,
  campaignName,
  saving,
  onClose,
  onConfirm,
}: {
  action: CampaignStatusAction | null;
  campaignName: string;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (status: CampaignStatus) => void;
}) {
  const t = useTranslations("campaigns.confirm");
  const common = useTranslations("common");
  if (!action) return null;

  const key = action === "paused" ? "pause" : action === "completed" ? "complete" : "resume";

  return (
    <Modal open title={t(`${key}Title`)} onClose={onClose} variant="light">
      <p className="text-sm leading-6 text-muted">{t(`${key}Body`, { name: campaignName })}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="light" disabled={saving} onClick={onClose}>
          {common("cancel")}
        </Button>
        <Button
          variant={action === "completed" ? "primary" : "brand"}
          disabled={saving}
          onClick={() => onConfirm(action)}
        >
          {t(`${key}Action`)}
        </Button>
      </div>
    </Modal>
  );
}

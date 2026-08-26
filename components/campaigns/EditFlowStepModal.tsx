"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { FLOW_VARIABLES, flowStepBody, flowStepTitle } from "@/lib/campaign-flow";
import type { CampaignFlowStep } from "@/types";

export function EditFlowStepModal({
  step,
  onClose,
  onSave,
}: {
  step: CampaignFlowStep | null;
  onClose: () => void;
  onSave: (step: CampaignFlowStep) => void;
}) {
  const t = useTranslations("campaigns.flow");
  const common = useTranslations("common");
  const locale = useLocale();
  // Resolve the built-in template into plain text so edits detach from it.
  const [draft, setDraft] = useState<CampaignFlowStep | null>(
    step
      ? {
          ...step,
          title: flowStepTitle(step, locale),
          body: flowStepBody(step, locale),
          templateKey: undefined,
        }
      : null,
  );

  if (!step) return null;
  const current = draft ?? step;

  return (
    <Modal
      open
      title={t("editTitle")}
      onClose={onClose}
      variant="light"
      className="max-w-xl"
    >
      <div className="space-y-4">
        {current.premium ? (
          <p className="rounded-xl border border-barney/20 bg-barney/5 px-3 py-2 text-sm text-barney">
            {t("premiumHint")}
          </p>
        ) : null}
        <Input
          id="flow-step-name"
          variant="light"
          label={t("stepName")}
          value={current.title}
          onChange={(event) =>
            setDraft({ ...current, title: event.target.value })
          }
        />
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">{t("variables")}</p>
          <div className="flex flex-wrap gap-2">
            {FLOW_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                className="rounded-full border border-purple-jam/15 bg-canvas px-3 py-1 text-xs font-medium text-ink hover:border-barney/40"
                onClick={() =>
                  setDraft({
                    ...current,
                    body: `${current.body}${current.body.endsWith(" ") || !current.body ? "" : " "}{{${variable}}}`,
                  })
                }
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-2">
          <span className="text-[13px] font-medium text-muted">{t("message")}</span>
          <textarea
            rows={7}
            value={current.body}
            onChange={(event) => setDraft({ ...current, body: event.target.value })}
            className="w-full rounded-xl border border-purple-jam/15 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-barney/50"
          />
        </label>
        <div className="space-y-2">
          <span className="text-[13px] font-medium text-muted">{t("delay")}</span>
          <SelectMenu
            id={`flow-delay-${step.id}`}
            value={String(current.delayDays)}
            ariaLabel={t("delay")}
            options={[0, 1, 3, 5, 7, 10, 14].map((days) => ({
              value: String(days),
              label: days === 0 ? t("noDelay") : t("waitDays", { count: days }),
            }))}
            onChange={(value) =>
              setDraft({ ...current, delayDays: Number(value) })
            }
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="light" onClick={onClose}>
            {common("cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(current);
              onClose();
            }}
          >
            {common("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

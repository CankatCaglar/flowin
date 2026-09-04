"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandAvatar } from "@/components/brands/BrandAvatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Brand } from "@/types";

export function BrandFormModal({
  open,
  brand,
  onClose,
  onSubmit,
  onRefreshPhoto,
}: {
  open: boolean;
  brand: Brand | null;
  onClose: () => void;
  onSubmit: (input: { name: string; linkedinCompany: string | null }) => Promise<void>;
  onRefreshPhoto?: () => void;
}) {
  const t = useTranslations("brands");
  const common = useTranslations("common");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(brand?.name ?? "");
      setCompany(brand?.linkedinCompany ?? "");
    }
  }, [open, brand]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!brand || !name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        linkedinCompany: company.trim() === "" ? null : company.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={t("modalEditTitle")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {brand ? (
          <div className="flex items-center gap-3">
            <BrandAvatar brand={{ ...brand, name: name || brand.name }} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{t("photoLabel")}</p>
              <p className="mt-1 text-xs leading-5 text-white/50">{t("photoHint")}</p>
              {onRefreshPhoto ? (
                <button
                  type="button"
                  onClick={onRefreshPhoto}
                  className="mt-2 text-xs font-medium text-barney hover:text-white"
                >
                  {t("photoRefresh")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-white">{t("nameLabel")}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            className="mt-2 h-11 w-full rounded-xl border border-purple-jam/40 bg-midnight/80 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-jam/80"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-white">{t("companyLabel")}</span>
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder={t("companyPlaceholder")}
            className="mt-2 h-11 w-full rounded-xl border border-purple-jam/40 bg-midnight/80 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-jam/80"
          />
          <p className="mt-1.5 text-[11px] text-white/40">{t("companyHint")}</p>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {common("cancel")}
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {t("update")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

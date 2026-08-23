"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Brand } from "@/types";

const colors = ["#6D1472", "#AE1BB6", "#2F5F9A", "#C47A1A", "#3D0A45", "#4A0E5C"];

export function BrandFormModal({
  open,
  brand,
  onClose,
  onSubmit,
}: {
  open: boolean;
  brand?: Brand | null;
  onClose: () => void;
  onSubmit: (input: { name: string; avatarColor: string }) => Promise<void>;
}) {
  const t = useTranslations("brands");
  const common = useTranslations("common");
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState(colors[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(brand?.name ?? "");
      setAvatarColor(brand?.avatarColor ?? colors[0]);
    }
  }, [open, brand]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), avatarColor });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={brand ? t("modalEditTitle") : t("modalCreateTitle")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="brand-name"
          label={t("nameLabel")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-white">
            {t("colorLabel")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setAvatarColor(color)}
                className="h-8 w-8 rounded-full border-2"
                style={{
                  backgroundColor: color,
                  borderColor: avatarColor === color ? "#ffffff" : "transparent",
                }}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {common("cancel")}
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {brand ? t("update") : t("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

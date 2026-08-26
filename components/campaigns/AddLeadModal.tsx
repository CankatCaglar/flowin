"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function AddLeadModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    fullName: string;
    linkedinUrl: string;
    company: string;
    position: string;
    email: string;
    phone: string;
  }) => Promise<void>;
}) {
  const t = useTranslations("campaigns.leads");
  const common = useTranslations("common");
  const [fullName, setFullName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setLinkedinUrl("");
    setCompany("");
    setPosition("");
    setEmail("");
    setPhone("");
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim() || !linkedinUrl.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        linkedinUrl: linkedinUrl.trim(),
        company: company.trim(),
        position: position.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={t("addTitle")} onClose={onClose} variant="light" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">{t("addHint")}</p>
        <Input
          id="lead-name"
          variant="light"
          label={t("name")}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <Input
          id="lead-linkedin"
          variant="light"
          label={t("linkedinUrl")}
          placeholder={t("linkedinPlaceholder")}
          value={linkedinUrl}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="lead-company"
            variant="light"
            label={t("company")}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
          <Input
            id="lead-position"
            variant="light"
            label={t("position")}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="lead-email"
            variant="light"
            label={t("email")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            id="lead-phone"
            variant="light"
            label={t("phone")}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="light" onClick={onClose} disabled={submitting}>
            {common("cancel")}
          </Button>
          <Button type="submit" disabled={submitting || !fullName.trim() || !linkedinUrl.trim()}>
            {t("addSubmit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

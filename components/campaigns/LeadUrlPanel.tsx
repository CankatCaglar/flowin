"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ImportedLead } from "@/lib/lead-import";
import { importLeadFromUrl } from "@/lib/outreach-api";

export function LeadUrlPanel({
  brandId,
  leads,
  onChange,
}: {
  brandId: string;
  leads: ImportedLead[];
  onChange: (leads: ImportedLead[]) => void;
}) {
  const t = useTranslations("campaigns.create");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const next = url.trim();
    if (!next || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await importLeadFromUrl(brandId, next);
      const key = result.lead.linkedinUrl.toLocaleLowerCase();
      if (leads.some((lead) => lead.linkedinUrl.toLocaleLowerCase() === key)) {
        setError("duplicate");
        return;
      }
      onChange([...leads, { ...result.lead, email: "", phone: "" }]);
      setUrl("");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "lookup-failed";
      setError(code === "invalid-url" ? "invalid" : "failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted">{t("profileUrlHint")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            id="profile-url"
            variant="light"
            label={t("profileUrl")}
            placeholder="https://www.linkedin.com/in/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
          />
        </div>
        <Button type="button" variant="brand" disabled={loading || !url.trim()} onClick={() => void add()}>
          {loading ? t("profileUrlLoading") : t("profileUrlAdd")}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-rose-600">
          {error === "duplicate"
            ? t("profileUrlDuplicate")
            : error === "invalid"
              ? t("profileUrlInvalid")
              : t("profileUrlFailed")}
        </p>
      ) : null}
      {leads.length > 0 ? (
        <ul className="divide-y divide-purple-jam/10 overflow-hidden rounded-xl border border-purple-jam/15 bg-white">
          {leads.map((lead) => (
            <li key={lead.linkedinUrl} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{lead.fullName}</p>
                <p className="truncate text-xs text-muted">
                  {[lead.position, lead.company].filter(Boolean).join(" · ") || lead.linkedinUrl}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-sm text-muted hover:text-barney"
                onClick={() =>
                  onChange(leads.filter((item) => item.linkedinUrl !== lead.linkedinUrl))
                }
              >
                {t("profileUrlRemove")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {leads.length > 0 ? <p className="text-sm text-ink">{t("importReady", { count: leads.length })}</p> : null}
    </div>
  );
}

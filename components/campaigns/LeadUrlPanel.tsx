"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ImportedLead } from "@/lib/lead-import";
import { findActiveOccupant, leadsShareIdentity } from "@/lib/lead-identity";
import { importLeadFromUrl } from "@/lib/outreach-api";
import type { Campaign, Lead } from "@/types";

export function LeadUrlPanel({
  brandId,
  leads,
  brandLeads = [],
  campaigns = [],
  onChange,
}: {
  brandId: string;
  leads: ImportedLead[];
  brandLeads?: Lead[];
  campaigns?: Campaign[];
  onChange: (leads: ImportedLead[]) => void;
}) {
  const t = useTranslations("campaigns.create");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState("");

  const add = async () => {
    const next = url.trim();
    if (!next || loading) return;
    setLoading(true);
    setError(null);
    setActiveCampaign("");
    try {
      const result = await importLeadFromUrl(brandId, next);
      if (leads.some((lead) => leadsShareIdentity(lead, result.lead))) {
        setError("duplicate");
        return;
      }
      const occupant = findActiveOccupant(brandLeads, campaigns, result.lead);
      if (occupant) {
        setError("active");
        setActiveCampaign(occupant.campaign.name);
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
            : error === "active"
              ? t("profileUrlActiveDuplicate", { campaign: activeCampaign })
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

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ImportedLead } from "@/lib/lead-import";
import { formatNumber } from "@/lib/utils";

export function ImportedLeadPreview({
  leads,
  fileName,
  skipped = 0,
}: {
  leads: ImportedLead[];
  fileName?: string;
  skipped?: number;
}) {
  const t = useTranslations("campaigns.create");
  const locale = useLocale();
  if (leads.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-purple-jam/15 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-purple-jam/10 px-3 py-2.5">
        <div className="min-w-0">
          {fileName ? <p className="truncate text-sm font-semibold text-ink">{fileName}</p> : null}
          <p className="text-xs text-muted">
            {t("importReady", { count: formatNumber(leads.length, locale) })}
            {skipped > 0 ? ` · ${t("importSkipped", { count: formatNumber(skipped, locale) })}` : ""}
          </p>
        </div>
        <p className="shrink-0 pt-0.5 text-[11px] text-muted">{t("importScroll")}</p>
      </div>
      <ul className="max-h-72 divide-y divide-purple-jam/8 overflow-y-auto overscroll-contain">
        {leads.map((lead, index) => (
          <li
            key={`${lead.unipileProviderId || lead.linkedinUrl || lead.fullName}-${index}`}
            className="px-3 py-2"
          >
            <p className="truncate text-sm font-medium text-ink">{lead.fullName}</p>
            <p className="truncate text-[11px] text-muted">
              {[lead.position, lead.company].filter(Boolean).join(" · ") || lead.linkedinUrl}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

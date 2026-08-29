"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { parseLeadFile, type ImportedLead } from "@/lib/lead-import";
import { formatNumber } from "@/lib/utils";

export function LeadImportPanel({
  leads,
  fileName,
  skipped,
  onParsed,
}: {
  leads: ImportedLead[];
  fileName: string;
  skipped: number;
  onParsed: (input: { leads: ImportedLead[]; fileName: string; skipped: number }) => void;
}) {
  const t = useTranslations("campaigns.create");
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const preview = leads.slice(0, 6);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      onParsed(await parseLeadFile(file));
    } catch {
      setError(t("importInvalid"));
      onParsed({ leads: [], fileName: "", skipped: 0 });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted">{t("importHint")}</p>
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-purple-jam/25 bg-canvas/60 px-4 py-8 text-center hover:border-barney/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFile(event.dataTransfer.files[0]);
        }}
      >
        <Upload className="h-5 w-5 text-barney" />
        <span className="mt-3 text-sm font-medium text-ink">
          {reading ? t("importReading") : t("importDrop")}
        </span>
        <span className="mt-1 text-xs text-muted">{t("importTypes")}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </label>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {fileName ? (
        <div className="rounded-xl border border-purple-jam/15 bg-white">
          <div className="flex items-center gap-3 border-b border-purple-jam/10 px-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{fileName}</p>
              <p className="text-[11px] text-muted">
                {t("importReady", { count: formatNumber(leads.length, locale) })}
                {skipped > 0 ? ` · ${t("importSkipped", { count: formatNumber(skipped, locale) })}` : ""}
              </p>
            </div>
          </div>
          {preview.length > 0 ? (
            <ul className="divide-y divide-purple-jam/10">
              {preview.map((lead) => (
                <li key={lead.linkedinUrl} className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{lead.fullName}</p>
                  <p className="truncate text-[11px] text-muted">
                    {[lead.position, lead.company].filter(Boolean).join(" · ") || lead.linkedinUrl}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-muted">{t("importEmpty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { ImportedLeadPreview } from "@/components/campaigns/ImportedLeadPreview";
import { parseLeadFile, type ImportedLead } from "@/lib/lead-import";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

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
      {fileName && leads.length > 0 ? (
        <ImportedLeadPreview leads={leads} fileName={fileName} skipped={skipped} />
      ) : fileName ? (
        <p className="text-sm text-muted">{t("importEmpty")}</p>
      ) : null}
    </div>
  );
}

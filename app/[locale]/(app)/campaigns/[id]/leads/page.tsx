"use client";

import { use, useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddLeadModal } from "@/components/campaigns/AddLeadModal";
import { CampaignLeadPanel, leadAvatarClass } from "@/components/campaigns/CampaignLeadPanel";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { createLead } from "@/lib/data";
import { formatDateTime, personInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Lead, LeadStage, LeadStatus } from "@/types";

const PAGE_SIZE = 7;
const STAGES: LeadStage[] = [
  "first_contact",
  "interested",
  "proposal",
  "awaiting_reply",
  "replied",
  "failed",
];
const STATUSES: LeadStatus[] = ["unresponsive", "replied", "in_progress"];

function exportCsv(leads: Lead[]) {
  const header = ["name", "company", "position", "email", "phone", "linkedin"];
  const lines = [
    header.join(","),
    ...leads.map((lead) =>
      [lead.fullName, lead.company, lead.position, lead.email, lead.phone, lead.linkedinUrl]
        .map((value) => `"${value.replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function CampaignLeadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("campaigns.leads");
  const campaignsT = useTranslations("campaigns");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const stageT = useTranslations("stage");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const { leads, refresh } = useBrandData(selectedBrand?.id ?? null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const campaignLeads = useMemo(
    () => leads.filter((lead) => lead.campaignId === id),
    [id, leads],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return campaignLeads.filter((lead) => {
      if (stage !== "all" && lead.stage !== stage) return false;
      if (status !== "all" && lead.status !== status) return false;
      if (
        term &&
        !`${lead.fullName} ${lead.company} ${lead.position}`.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [campaignLeads, query, stage, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const slots = Array.from({ length: PAGE_SIZE }, (_, index) => rows[index] ?? null);
  const selected = filtered.find((lead) => lead.id === selectedId) ?? null;
  const from = filtered.length === 0 ? 0 : pageStart + 1;
  const to = Math.min(pageStart + PAGE_SIZE, filtered.length);

  return (
    <div
      className={cn(
        "grid items-stretch gap-6",
        selected ? "xl:grid-cols-[minmax(0,1fr)_26rem]" : "grid-cols-1",
      )}
    >
      <div className="surface-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex shrink-0 flex-col gap-3 border-b border-purple-jam/8 p-4 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              className="h-10 w-full rounded-xl border border-purple-jam/15 bg-white py-2 pl-10 pr-3 text-sm text-ink outline-none focus:border-barney/40"
            />
          </label>
          <SelectMenu
            id="campaign-leads-stage"
            className="w-40 shrink-0"
            triggerClassName="h-10"
            value={stage}
            ariaLabel={t("stage")}
            options={[
              { value: "all", label: t("stage") },
              ...STAGES.map((item) => ({ value: item, label: stageT(item) })),
            ]}
            onChange={(value) => {
              setStage(value as LeadStage | "all");
              setPage(1);
            }}
          />
          <SelectMenu
            id="campaign-leads-status"
            className="w-40 shrink-0"
            triggerClassName="h-10"
            value={status}
            ariaLabel={t("status")}
            options={[
              { value: "all", label: t("status") },
              ...STATUSES.map((item) => ({ value: item, label: statusT(item) })),
            ]}
            onChange={(value) => {
              setStatus(value as LeadStatus | "all");
              setPage(1);
            }}
          />
          <Button variant="brand" className="h-10 shrink-0" onClick={() => exportCsv(filtered)}>
            <Download className="h-4 w-4" />
            {t("export")}
          </Button>
          <Button
            className="h-10 shrink-0"
            disabled={!selectedBrand}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="h-11">
                <th className="w-10 px-3 font-medium" />
                <th className="whitespace-nowrap px-3 font-medium">{t("name")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("company")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("position")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("stage")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("status")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("lastAction")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("lastReply")}</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((lead, index) => {
                if (!lead) {
                  return (
                    <tr key={`empty-${index}`} className="h-14 border-t border-purple-jam/8">
                      <td colSpan={8} />
                    </tr>
                  );
                }
                const active = selected?.id === lead.id;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      "h-14 cursor-pointer border-t border-purple-jam/8",
                      active ? "bg-barney/5" : "hover:bg-canvas/70",
                    )}
                  >
                    <td className="px-3">
                      <span
                        className={cn(
                          "mx-auto flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white",
                          active ? "border-barney" : "border-purple-jam/25",
                        )}
                      >
                        {active ? <span className="h-1.5 w-1.5 rounded-full bg-barney" /> : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3">
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            leadAvatarClass(lead.id),
                          )}
                        >
                          {personInitials(lead.fullName)}
                        </span>
                        <span className="font-medium text-ink">{lead.fullName}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 text-muted">{lead.company}</td>
                    <td className="whitespace-nowrap px-3 text-muted">{lead.position}</td>
                    <td className="px-3">
                      <StageBadge stage={lead.stage} label={stageT(lead.stage)} />
                    </td>
                    <td className="px-3">
                      <StatusBadge status={lead.status} label={statusT(lead.status)} />
                    </td>
                    <td className="whitespace-nowrap px-3 text-muted">
                      {formatDateTime(lead.lastMessageSentAt, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 text-muted">
                      {lead.firstReplyReceivedAt
                        ? formatDateTime(lead.firstReplyReceivedAt, locale)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-purple-jam/8 px-4 py-3">
          <p className="text-sm text-muted">
            {filtered.length === 0 ? common("empty") : t("showing", { from, to, total: filtered.length })}
          </p>
          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
            prevLabel={campaignsT("prevPage")}
            nextLabel={campaignsT("nextPage")}
          />
        </div>
      </div>
      {selected ? (
        <CampaignLeadPanel lead={selected} onClose={() => setSelectedId(null)} />
      ) : null}
      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (input) => {
          if (!selectedBrand) return;
          const lead = await createLead({
            brandId: selectedBrand.id,
            campaignId: id,
            ...input,
          });
          refresh();
          setQuery("");
          setStage("all");
          setStatus("all");
          setPage(1);
          setSelectedId(lead.id);
        }}
      />
    </div>
  );
}

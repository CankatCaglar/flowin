"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddLeadModal } from "@/components/campaigns/AddLeadModal";
import { LeadDetailPanel, leadAvatarClass } from "@/components/leads/LeadDetailPanel";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Link } from "@/i18n/navigation";
import { exportLeadsCsv, leadLastActionAt, LEAD_STAGES, LEAD_STATUSES } from "@/lib/leads";
import { formatLastAction, personInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign, Lead, LeadStage, LeadStatus } from "@/types";

const PAGE_SIZE = 7;

export function LeadsWorkspace({
  leads,
  campaigns,
  showCampaign = false,
  initialCampaignId = "all",
  initialStatus = "all",
  onAddLead,
}: {
  leads: Lead[];
  campaigns: Campaign[];
  showCampaign?: boolean;
  initialCampaignId?: string;
  initialStatus?: LeadStatus | "all";
  onAddLead?: (input: {
    fullName: string;
    linkedinUrl: string;
    company: string;
    position: string;
    email: string;
    phone: string;
  }) => Promise<Lead | void>;
}) {
  const t = useTranslations("campaigns.leads");
  const campaignsT = useTranslations("campaigns");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const stageT = useTranslations("stage");
  const locale = useLocale();
  const { now } = useDateRange();
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [status, setStatus] = useState<LeadStatus | "all">(initialStatus);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const campaignNames = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.name])),
    [campaigns],
  );

  const campaignOptions = useMemo(
    () =>
      campaigns
        .filter((campaign) => campaign.status !== "draft")
        .map((campaign) => ({ value: campaign.id, label: campaign.name })),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (showCampaign && campaignId !== "all" && lead.campaignId !== campaignId) return false;
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
  }, [campaignId, leads, query, showCampaign, stage, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const slots = Array.from({ length: PAGE_SIZE }, (_, index) => rows[index] ?? null);
  const selected = filtered.find((lead) => lead.id === selectedId) ?? null;
  const from = filtered.length === 0 ? 0 : pageStart + 1;
  const to = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const colCount = showCampaign ? 7 : 6;

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
          {showCampaign ? (
            <SelectMenu
              id="leads-campaign"
              className="w-48 shrink-0"
              triggerClassName="h-10"
              value={campaignId}
              ariaLabel={t("campaign")}
              options={[
                { value: "all", label: t("allCampaigns") },
                ...campaignOptions,
              ]}
              onChange={(value) => {
                setCampaignId(value);
                setPage(1);
              }}
            />
          ) : null}
          <SelectMenu
            id="leads-stage"
            className="w-44 shrink-0"
            triggerClassName="h-10"
            value={stage}
            ariaLabel={t("stage")}
            options={[
              { value: "all", label: t("stage") },
              ...LEAD_STAGES.map((item) => ({ value: item, label: stageT(item) })),
            ]}
            onChange={(value) => {
              setStage(value as LeadStage | "all");
              setPage(1);
            }}
          />
          <SelectMenu
            id="leads-status"
            className="w-44 shrink-0"
            triggerClassName="h-10"
            value={status}
            ariaLabel={t("status")}
            options={[
              { value: "all", label: t("status") },
              ...LEAD_STATUSES.map((item) => ({ value: item, label: statusT(item) })),
            ]}
            onChange={(value) => {
              setStatus(value as LeadStatus | "all");
              setPage(1);
            }}
          />
          <Button
            variant="brand"
            className="h-10 shrink-0"
            onClick={() =>
              exportLeadsCsv(filtered, {
                campaignNames,
                stageLabel: (item) => stageT(item),
                statusLabel: (item) => statusT(item),
                lastAction: (lead) => formatLastAction(leadLastActionAt(lead), now, locale),
              })
            }
          >
            <Upload className="h-4 w-4" />
            {t("export")}
          </Button>
          {onAddLead ? (
            <Button className="h-10 shrink-0" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("add")}
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="h-11 border-l-[3px] border-l-transparent">
                <th className="whitespace-nowrap px-4 font-medium">{t("name")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("company")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("position")}</th>
                {showCampaign ? (
                  <th className="whitespace-nowrap px-3 font-medium">{t("campaign")}</th>
                ) : null}
                <th className="whitespace-nowrap px-3 font-medium">{t("stage")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("status")}</th>
                <th className="whitespace-nowrap px-3 font-medium">{t("lastAction")}</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((lead, index) => {
                if (!lead) {
                  return (
                    <tr key={`empty-${index}`} className="h-14 border-t border-purple-jam/8 border-l-[3px] border-l-transparent">
                      <td colSpan={colCount} />
                    </tr>
                  );
                }
                const active = selected?.id === lead.id;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      "h-14 cursor-pointer border-t border-purple-jam/8 border-l-[3px]",
                      active
                        ? "border-l-barney bg-barney/5"
                        : "border-l-transparent hover:bg-canvas/70",
                    )}
                  >
                    <td className="whitespace-nowrap px-4">
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
                    {showCampaign ? (
                      <td className="whitespace-nowrap px-3">
                        <Link
                          href={`/campaigns/${lead.campaignId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-barney hover:opacity-80"
                        >
                          {campaignNames.get(lead.campaignId) ?? lead.campaignId}
                        </Link>
                      </td>
                    ) : null}
                    <td className="px-3">
                      <StageBadge stage={lead.stage} label={stageT(lead.stage)} />
                    </td>
                    <td className="px-3">
                      <StatusBadge status={lead.status} label={statusT(lead.status)} />
                    </td>
                    <td className="whitespace-nowrap px-3 text-muted">
                      {formatLastAction(leadLastActionAt(lead), now, locale)}
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
        <LeadDetailPanel
          lead={selected}
          campaignName={campaignNames.get(selected.campaignId)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
      {onAddLead ? (
        <AddLeadModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            const created = await onAddLead(input);
            setQuery("");
            setStage("all");
            setStatus("all");
            setCampaignId(showCampaign ? "all" : campaignId);
            setPage(1);
            setAddOpen(false);
            if (created?.id) setSelectedId(created.id);
          }}
        />
      ) : null}
    </div>
  );
}

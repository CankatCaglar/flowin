"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AddLeadModal } from "@/components/campaigns/AddLeadModal";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Link } from "@/i18n/navigation";
import { leadStatusLabel } from "@/lib/lead-status";
import {
  exportLeadsCsv,
  leadLastActionAt,
  isLeadFlowTerminal,
  leadStatusLabelKey,
  LEAD_STAGES,
  LEAD_STATUS_FILTERS,
  type LeadStatusLabelKey,
} from "@/lib/leads";
import { leadNeedsOurReply } from "@/lib/chat-thread";
import { displayLeadCompany } from "@/lib/linkedin-company";
import { EMPTY_METRIC, formatLastAction } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign, Lead, LeadStage, LeadStatus, OutreachMessage } from "@/types";

const PAGE_SIZE = 10;

export function LeadsWorkspace({
  leads,
  campaigns,
  messages = [],
  showCampaign = false,
  initialCampaignId = "all",
  initialStatus = "all",
  initialStage = "all",
  replyWaitOnly = false,
  initialLeadId = "",
  onAddLead,
}: {
  leads: Lead[];
  campaigns: Campaign[];
  messages?: OutreachMessage[];
  showCampaign?: boolean;
  initialCampaignId?: string;
  initialStatus?: LeadStatus | "all";
  initialStage?: LeadStage | "campaign_ended" | "all";
  replyWaitOnly?: boolean;
  initialLeadId?: string;
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
  const [stage, setStage] = useState<LeadStage | "campaign_ended" | "all">(initialStage);
  const [status, setStatus] = useState<LeadStatusLabelKey | "all">(
    initialStatus === "failed" ? "all" : initialStatus,
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId || null);
  const [addOpen, setAddOpen] = useState(false);
  const [userPage, setUserPage] = useState<number | null>(null);

  const campaignNames = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign.name])),
    [campaigns],
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
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
      const ended =
        campaignById.get(lead.campaignId)?.status === "completed" && !isLeadFlowTerminal(lead);
      if (showCampaign && campaignId !== "all" && lead.campaignId !== campaignId) return false;
      if (stage !== "all" && (ended ? "campaign_ended" : lead.stage) !== stage) return false;
      if (status !== "all") {
        const key = ended ? "campaign_ended" : leadStatusLabelKey(lead, campaignById.get(lead.campaignId)?.status);
        if (key !== status) return false;
      }
      if (replyWaitOnly && !leadNeedsOurReply(lead, messages)) return false;
      if (
        term &&
        !`${lead.fullName} ${displayLeadCompany(lead)} ${lead.position}`.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => leadLastActionAt(b).getTime() - leadLastActionAt(a).getTime());
  }, [campaignById, campaignId, leads, messages, query, replyWaitOnly, showCampaign, stage, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const leadIndex = initialLeadId ? filtered.findIndex((lead) => lead.id === initialLeadId) : -1;
  const leadPage = leadIndex >= 0 ? Math.floor(leadIndex / PAGE_SIZE) + 1 : 1;
  const page = userPage ?? leadPage;
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
        "grid items-stretch gap-4 sm:gap-6",
        selected
          ? "xl:grid-cols-[minmax(0,1fr)_26rem] xl:grid-rows-[minmax(32rem,auto)] xl:items-stretch"
          : "grid-cols-1",
      )}
    >
      <div className="surface-card flex min-h-0 h-full flex-col overflow-hidden rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-purple-jam/8 p-3 [scrollbar-width:none] sm:gap-3 sm:p-4 [&::-webkit-scrollbar]:hidden">
          <label className="relative min-w-36 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setUserPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-full rounded-xl border border-purple-jam/15 bg-white py-2 pl-10 pr-3 text-sm text-ink outline-none focus:border-barney/40 sm:h-10"
            />
          </label>
          {showCampaign ? (
            <SelectMenu
              id="leads-campaign"
              className="w-48 shrink-0"
              triggerClassName="h-9 sm:h-10"
              value={campaignId}
              ariaLabel={t("campaign")}
              options={[
                { value: "all", label: t("allCampaigns") },
                ...campaignOptions,
              ]}
              onChange={(value) => {
                setCampaignId(value);
                setUserPage(1);
              }}
            />
          ) : null}
          <SelectMenu
            id="leads-stage"
            className="w-44 shrink-0"
            triggerClassName="h-9 sm:h-10"
            value={stage}
            ariaLabel={t("stage")}
            options={[
              { value: "all", label: t("stage") },
              ...LEAD_STAGES.map((item) => ({ value: item, label: stageT(item) })),
              { value: "campaign_ended", label: stageT("campaign_ended") },
            ]}
            onChange={(value) => {
              setStage(value as LeadStage | "campaign_ended" | "all");
              setUserPage(1);
            }}
          />
          <SelectMenu
            id="leads-status"
            className="w-56 shrink-0"
            triggerClassName="h-9 sm:h-10"
            value={status}
            ariaLabel={t("status")}
            options={[
              { value: "all", label: t("status") },
              ...LEAD_STATUS_FILTERS.map((item) => ({ value: item, label: statusT(item) })),
            ]}
            onChange={(value) => {
              setStatus(value as LeadStatusLabelKey | "all");
              setUserPage(1);
            }}
          />
          <Button
            variant="brand"
            className="h-9 shrink-0 px-2.5 sm:h-10 sm:px-4"
            onClick={() =>
              exportLeadsCsv(filtered, {
                campaignNames,
                stageLabel: (item) => stageT(item),
                statusLabel: (_status, lead) =>
                  leadStatusLabel(lead, {
                    campaign: campaignById.get(lead.campaignId),
                    locale,
                    t: statusT,
                  }),
                lastAction: (lead) => formatLastAction(leadLastActionAt(lead), now, locale),
              })
            }
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">{t("export")}</span>
          </Button>
          {onAddLead ? (
            <Button className="h-9 shrink-0 px-2.5 sm:h-10 sm:px-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("add")}</span>
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-208 text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted">
              <tr className="h-10 border-l-[3px] border-l-transparent">
                <th className="px-3 py-2 text-left font-medium">{t("name")}</th>
                <th className="w-38 px-3 py-2 text-center font-medium">
                  <span className="inline-flex w-full justify-center">{t("company")}</span>
                </th>
                <th className="w-44 px-3 py-2 text-center font-medium">
                  <span className="inline-flex w-full justify-center">{t("position")}</span>
                </th>
                {showCampaign ? (
                  <th className="px-3 py-2 text-center font-medium">
                    <span className="inline-flex w-full justify-center">{t("campaign")}</span>
                  </th>
                ) : null}
                <th className="px-3 py-2 text-center font-medium">
                  <span className="inline-flex w-full justify-center">{t("stage")}</span>
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  <span className="inline-flex w-full justify-center">{t("status")}</span>
                </th>
                <th className="px-3 py-2 text-center font-medium">
                  <span className="inline-flex w-full justify-center">{t("lastAction")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map((lead, index) => {
                if (!lead) {
                  return (
                    <tr key={`empty-${index}`} className="h-12 border-t border-purple-jam/8 border-l-[3px] border-l-transparent">
                      <td colSpan={colCount} />
                    </tr>
                  );
                }
                const active = selected?.id === lead.id;
                const campaignStatus = campaignById.get(lead.campaignId)?.status;
                const campaignEnded = campaignStatus === "completed" && !isLeadFlowTerminal(lead);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      "h-12 cursor-pointer border-t border-purple-jam/8 border-l-[3px]",
                      active
                        ? "border-l-barney bg-barney/5"
                        : "border-l-transparent hover:bg-canvas/70",
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="flex items-center gap-2">
                        <LeadAvatar lead={lead} />
                        <span className="max-w-40 truncate text-[13px] font-medium text-ink" title={lead.fullName}>
                          {lead.fullName}
                        </span>
                      </span>
                    </td>
                    <td className="max-w-38 px-3 py-2 text-center text-muted">
                      <span
                        className="line-clamp-2 leading-tight wrap-break-word"
                        title={displayLeadCompany(lead) || undefined}
                      >
                        {displayLeadCompany(lead) || EMPTY_METRIC}
                      </span>
                    </td>
                    <td className="max-w-44 px-3 py-2 text-center text-muted">
                      <span className="line-clamp-2 leading-tight wrap-break-word" title={lead.position || undefined}>
                        {lead.position || EMPTY_METRIC}
                      </span>
                    </td>
                    {showCampaign ? (
                      <td className="max-w-36 px-3 py-2 text-center">
                        <Link
                          href={`/campaigns/${lead.campaignId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block truncate text-barney hover:opacity-80"
                          title={campaignNames.get(lead.campaignId) ?? lead.campaignId}
                        >
                          {campaignNames.get(lead.campaignId) ?? lead.campaignId}
                        </Link>
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-center">
                      <StageBadge
                        stage={campaignEnded ? "pending" : lead.stage}
                        label={campaignEnded ? stageT("campaign_ended") : stageT(lead.stage)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge
                        plain
                        status={campaignEnded ? "completed" : lead.status}
                        label={leadStatusLabel(lead, {
                          campaign: campaignById.get(lead.campaignId),
                          campaignStatus,
                          locale,
                          t: statusT,
                        })}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-muted">
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
            onPageChange={setUserPage}
            prevLabel={campaignsT("prevPage")}
            nextLabel={campaignsT("nextPage")}
          />
        </div>
      </div>
      {selected ? (
        <div className="min-h-0 xl:h-0 xl:min-h-full">
          <LeadDetailPanel
            lead={selected}
            campaign={campaigns.find((item) => item.id === selected.campaignId)}
            campaignName={campaignNames.get(selected.campaignId)}
            onClose={() => setSelectedId(null)}
          />
        </div>
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
            setUserPage(1);
            setAddOpen(false);
            if (created?.id) setSelectedId(created.id);
          }}
        />
      ) : null}
    </div>
  );
}

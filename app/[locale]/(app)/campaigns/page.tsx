"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CampaignDateFilter, type CampaignDatePreset } from "@/components/campaigns/CampaignDateFilter";
import { CampaignRowMenu } from "@/components/campaigns/CampaignRowMenu";
import { CampaignStatusFilter } from "@/components/campaigns/CampaignStatusFilter";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableRowSkeleton } from "@/components/ui/PageSkeleton";
import { useBrand } from "@/contexts/BrandContext";
import { useBrandData } from "@/hooks/useBrandData";
import { Link, useRouter } from "@/i18n/navigation";
import { campaignIconStyle } from "@/lib/campaign-icon";
import { addDays, appToday, startOfDay } from "@/lib/dates";
import { cn, formatDateTime, formatNumber, formatSuccessRate, successRate } from "@/lib/utils";
import type { Campaign, CampaignStatus, Lead } from "@/types";

const PAGE_SIZE = 6;
const FILTERS: Array<"all" | CampaignStatus> = [
  "all",
  "active",
  "paused",
  "expiring",
  "draft",
  "completed",
];

type SortKey = "name" | "total" | "sent" | "replied" | "success" | "status" | "created";

const CENTERED_COLUMNS = new Set<SortKey>([
  "total",
  "sent",
  "replied",
  "success",
  "status",
  "created",
]);

const STATUS_ORDER: Record<CampaignStatus, number> = {
  active: 0,
  expiring: 1,
  paused: 2,
  draft: 3,
  completed: 4,
};

function dateWindow(preset: CampaignDatePreset) {
  if (preset === "all") return null;
  const today = appToday();
  const end = startOfDay(today);
  if (preset === "last7") {
    return { start: startOfDay(addDays(today, -6)), end };
  }
  return { start: startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)), end };
}

function createdInWindow(campaign: Campaign, preset: CampaignDatePreset) {
  const window = dateWindow(preset);
  if (!window) return true;
  const created = startOfDay(campaign.createdAt);
  return created >= window.start && created <= window.end;
}

function totalLeads(campaign: Campaign, leads: Lead[]) {
  const count = leads.filter((lead) => lead.campaignId === campaign.id).length;
  return count > 0 ? count : campaign.leadGoal;
}

function compareCampaigns(
  a: Campaign,
  b: Campaign,
  key: SortKey,
  dir: 1 | -1,
  leads: Lead[],
) {
  const factor = dir;
  if (key === "name") return a.name.localeCompare(b.name) * factor;
  if (key === "total") return (totalLeads(a, leads) - totalLeads(b, leads)) * factor;
  if (key === "sent") return (a.sentCount - b.sentCount) * factor;
  if (key === "replied") return (a.repliedCount - b.repliedCount) * factor;
  if (key === "success") {
    return (
      (successRate(a.sentCount, a.repliedCount) - successRate(b.sentCount, b.repliedCount)) * factor
    );
  }
  if (key === "status") return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * factor;
  return (a.createdAt.getTime() - b.createdAt.getTime()) * factor;
}

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const { campaigns, leads, loading, refresh } = useBrandData(selectedBrand?.id ?? null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [dateFilter, setDateFilter] = useState<CampaignDatePreset>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = campaigns.filter((campaign) => {
      if (filter !== "all" && campaign.status !== filter) return false;
      if (!createdInWindow(campaign, dateFilter)) return false;
      if (term && !campaign.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...rows].sort((a, b) => compareCampaigns(a, b, sortKey, sortDir, leads));
  }, [campaigns, dateFilter, filter, leads, query, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 1 ? -1 : 1));
      return;
    }
    setSortKey(key);
    setSortDir(1);
  };

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 flex items-center gap-2">
        <label className="relative w-44 shrink-0 sm:w-52">
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
        <CampaignStatusFilter
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <CampaignDateFilter
          value={dateFilter}
          onChange={(value) => {
            setDateFilter(value);
            setPage(1);
          }}
        />
        <Button className="h-10 shrink-0" onClick={() => router.push("/campaigns/new")}>
          <Plus className="h-4 w-4" />
          {t("new")}
        </Button>
      </div>
      <div className="surface-card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-220 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              {(
                [
                  ["name", t("name")],
                  ["total", t("totalLeads")],
                  ["sent", t("sent")],
                  ["replied", t("replied")],
                  ["success", t("success")],
                  ["status", t("status")],
                  ["created", t("createdAt")],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className={cn("px-5 py-3 font-medium", CENTERED_COLUMNS.has(key) && "text-center")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-ink",
                      CENTERED_COLUMNS.has(key) && "justify-center",
                    )}
                  >
                    {label}
                    <ArrowUpDown
                      className={cn(
                        "h-3.5 w-3.5",
                        sortKey === key ? "text-barney" : "text-muted/70",
                      )}
                    />
                  </button>
                </th>
              ))}
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? <TableRowSkeleton cols={8} /> : null}
            {rows.map((campaign) => {
              const visual = campaignIconStyle(campaign.id);
              const Icon = visual.icon;
              return (
                <tr key={campaign.id} className="border-t border-purple-jam/8 hover:bg-canvas/70">
                  <td className="px-5 py-3">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center gap-3 font-medium text-ink hover:text-barney"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          visual.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-center text-muted">
                    {formatNumber(totalLeads(campaign, leads), locale)}
                  </td>
                  <td className="px-5 py-3 text-center text-muted">
                    {formatNumber(campaign.sentCount, locale)}
                  </td>
                  <td className="px-5 py-3 text-center text-muted">
                    {formatNumber(campaign.repliedCount, locale)}
                  </td>
                  <td className="px-5 py-3 text-center text-muted">
                    {formatSuccessRate(campaign.sentCount, campaign.repliedCount, locale)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={campaign.status} label={statusT(campaign.status)} />
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-center text-muted">
                    {formatDateTime(campaign.createdAt, locale)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <CampaignRowMenu campaign={campaign} onChanged={refresh} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{common("empty")}</p>
        ) : null}
        {filtered.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-purple-jam/8 px-5 py-3">
            <p className="text-sm text-muted">
              {t("pagination", { from, to, total: filtered.length })}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t("prevPage")}
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-jam/10 text-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={cn(
                    "h-8 w-8 rounded-lg border text-sm font-medium",
                    item === safePage
                      ? "border-barney bg-barney/10 text-ink"
                      : "border-purple-jam/10 text-muted hover:bg-canvas",
                  )}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                aria-label={t("nextPage")}
                disabled={safePage >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-jam/10 text-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

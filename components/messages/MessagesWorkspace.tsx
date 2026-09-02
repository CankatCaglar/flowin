"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { formatLastAction } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign, Lead, OutreachMessage } from "@/types";

function groupThreads(messages: OutreachMessage[]) {
  const byLead = new Map<string, OutreachMessage[]>();
  for (const message of messages) {
    const list = byLead.get(message.leadId) ?? [];
    list.push(message);
    byLead.set(message.leadId, list);
  }
  return [...byLead.values()]
    .map((items) => {
      const sorted = [...items].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
      const last = sorted[sorted.length - 1];
      return {
        leadId: last.leadId,
        leadName: last.leadName,
        campaignId: last.campaignId,
        campaignName: last.campaignName,
        messages: sorted,
        last,
        hasInbound: sorted.some((item) => item.direction === "inbound"),
      };
    })
    .sort((a, b) => b.last.sentAt.getTime() - a.last.sentAt.getTime());
}

export function MessagesWorkspace({
  messages,
  leads,
  campaigns,
  now,
}: {
  messages: OutreachMessage[];
  leads: Lead[];
  campaigns: Campaign[];
  now: Date;
}) {
  const t = useTranslations("messages");
  const common = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [filter, setFilter] = useState<"all" | "replies">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const threads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groupThreads(messages).filter((thread) => {
      if (campaignId !== "all" && thread.campaignId !== campaignId) return false;
      if (filter === "replies" && !thread.hasInbound) return false;
      if (
        term &&
        !`${thread.leadName} ${thread.campaignName} ${thread.last.body}`.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [campaignId, filter, messages, query]);

  const selected = threads.find((thread) => thread.leadId === selectedId) ?? threads[0] ?? null;
  const selectedLead = selected ? leadsById.get(selected.leadId) : undefined;

  return (
    <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-purple-jam/10 bg-white xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col border-b border-purple-jam/10 xl:border-b-0 xl:border-r">
        <div className="space-y-3 border-b border-purple-jam/8 p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="h-10 w-full rounded-xl border border-purple-jam/15 bg-white px-3 text-sm text-ink outline-none focus:border-barney/40"
          />
          <SelectMenu
            id="messages-campaign"
            className="w-full"
            triggerClassName="h-10"
            value={campaignId}
            ariaLabel={t("campaign")}
            options={[
              { value: "all", label: t("allCampaigns") },
              ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
            ]}
            onChange={setCampaignId}
          />
          <div className="flex gap-2">
            {(
              [
                ["all", t("filterAll")],
                ["replies", t("filterReplies")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  filter === value
                    ? "bg-barney text-white"
                    : "bg-canvas text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {threads.map((thread) => {
            const lead = leadsById.get(thread.leadId);
            const active = selected?.leadId === thread.leadId;
            return (
              <li key={thread.leadId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(thread.leadId)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left",
                    active ? "bg-barney/5" : "hover:bg-canvas/70",
                  )}
                >
                  {lead ? (
                    <LeadAvatar lead={lead} />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-barney">
                      {thread.leadName.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{thread.leadName}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {formatLastAction(thread.last.sentAt, now, locale)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-barney">{thread.campaignName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{thread.last.body}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {threads.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">{t("empty")}</p>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-col">
        {selected ? (
          <>
            <header className="border-b border-purple-jam/8 px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">{selected.leadName}</h2>
              <p className="text-sm text-muted">
                {selectedLead?.company || selectedLead?.position
                  ? [selectedLead.position, selectedLead.company].filter(Boolean).join(" · ")
                  : selected.campaignName}
              </p>
              <p className="mt-1 text-xs text-barney">{selected.campaignName}</p>
            </header>
            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {selected.messages.map((message) => {
                const inbound = message.direction === "inbound";
                return (
                  <li
                    key={message.id}
                    className={cn("flex", inbound ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        inbound ? "bg-canvas text-ink" : "bg-barney text-white",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className={cn("mt-2 text-[11px]", inbound ? "text-muted" : "text-white/70")}>
                        {t(message.direction)} · {formatLastAction(message.sentAt, now, locale)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="m-auto px-6 text-sm text-muted">{common("empty")}</p>
        )}
      </section>
    </div>
  );
}

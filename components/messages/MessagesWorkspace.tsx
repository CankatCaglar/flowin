"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useBrand } from "@/contexts/BrandContext";
import { isReactionNotice, leadNeedsOurReply, messageIsLeadReply, toChatBubbles } from "@/lib/chat-thread";
import { deleteManualMessage, fetchMessages, sendManualMessage } from "@/lib/outreach-api";
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
      const last =
        [...sorted].reverse().find((item) => !isReactionNotice(item.body)) ?? sorted[sorted.length - 1];
      return {
        leadId: last.leadId,
        leadName: last.leadName,
        campaignId: last.campaignId,
        campaignName: last.campaignName,
        messages: sorted,
        last,
        hasInbound: sorted.some(messageIsLeadReply),
      };
    })
    .sort((a, b) => b.last.sentAt.getTime() - a.last.sentAt.getTime());
}

export function MessagesWorkspace({
  brandId,
  messages,
  leads,
  campaigns,
  now,
  onSent,
  initialCampaignId = "all",
  initialFilter = "all",
}: {
  brandId: string;
  messages: OutreachMessage[];
  leads: Lead[];
  campaigns: Campaign[];
  now: Date;
  onSent?: () => void;
  initialCampaignId?: string;
  initialFilter?: "all" | "replies" | "ours";
}) {
  const t = useTranslations("messages");
  const common = useTranslations("common");
  const locale = useLocale();
  const { selectedBrand } = useBrand();
  const threadScrollRef = useRef<HTMLOListElement | null>(null);
  const threadEndRef = useRef<HTMLLIElement | null>(null);
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [filter, setFilter] = useState<"all" | "replies" | "ours">(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<OutreachMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<OutreachMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const visibleMessages = useMemo(() => {
    const seen = new Set(messages.map((item) => item.id));
    const hidden = new Set(hiddenIds);
    return [...messages, ...extras.filter((item) => !seen.has(item.id))].filter(
      (item) => !hidden.has(item.id),
    );
  }, [extras, hiddenIds, messages]);
  const threads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groupThreads(visibleMessages).filter((thread) => {
      if (campaignId !== "all" && thread.campaignId !== campaignId) return false;
      if (filter === "replies" && !thread.hasInbound) return false;
      if (filter === "ours" && !leadNeedsOurReply({ id: thread.leadId }, thread.messages)) return false;
      if (
        term &&
        !`${thread.leadName} ${thread.campaignName} ${thread.last.body}`.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [campaignId, filter, query, visibleMessages]);

  const selected = threads.find((thread) => thread.leadId === selectedId) ?? threads[0] ?? null;
  const selectedLead = selected ? leadsById.get(selected.leadId) : undefined;
  const bubbles = useMemo(
    () => (selected ? toChatBubbles(selected.messages) : []),
    [selected],
  );
  const draft = selected ? (drafts[selected.leadId] ?? "") : "";
  const canCompose =
    Boolean(brandId && selected) &&
    selectedBrand?.unipileStatus === "running" &&
    !selectedBrand.testMode &&
    !selectedBrand.outreachPaused &&
    !selectedBrand.archived;

  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  useEffect(() => {
    const scroller = threadScrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [selected?.leadId, bubbles.length]);

  useEffect(() => {
    if (!brandId || !selected?.leadId) return;
    let cancelled = false;
    void fetchMessages(brandId, selected.leadId)
      .then(() => {
        if (!cancelled) onSentRef.current?.();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [brandId, selected?.leadId]);

  const sendErrorMessage = (code: string) => {
    if (code === "test-mode") return t("sendTestMode");
    if (code === "outreach-paused") return t("sendPaused");
    if (code === "seat-disconnected") return t("sendSeat");
    if (code === "not-connected") return t("sendNotConnected");
    if (code === "missing-linkedin") return t("sendMissing");
    return t("sendError");
  };

  const deleteErrorMessage = (code: string) => {
    if (code === "linkedin-denied") return t("remove.denied");
    if (code === "linkedin-missing") return t("remove.missing");
    if (code === "linkedin-too-old") return t("remove.tooOld");
    if (code === "test-mode") return t("sendTestMode");
    if (code === "outreach-paused") return t("sendPaused");
    if (code === "seat-disconnected") return t("sendSeat");
    return t("remove.error");
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setSendError("");
    try {
      await deleteManualMessage(brandId, pendingDelete.id);
      setHiddenIds((current) => [...current, pendingDelete.id]);
      setExtras((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
      onSent?.();
    } catch (error) {
      setSendError(deleteErrorMessage(error instanceof Error ? error.message : "delete-failed"));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const submitDraft = async () => {
    if (!selected || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setSendError("");
    try {
      const message = await sendManualMessage(brandId, selected.leadId, body);
      setExtras((current) => [...current, message]);
      setDrafts((current) => ({ ...current, [selected.leadId]: "" }));
      onSent?.();
    } catch (error) {
      setSendError(sendErrorMessage(error instanceof Error ? error.message : "send-failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 overflow-hidden rounded-2xl border border-purple-jam/10 bg-white max-xl:grid-rows-[minmax(12rem,38%)_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
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
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", t("filterAll")],
                ["replies", t("filterReplies")],
                ["ours", t("filterOurs")],
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
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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

      <section className="flex min-h-0 flex-col overflow-hidden">
        {selected ? (
          <>
            <header className="shrink-0 border-b border-purple-jam/8 px-5 py-4">
              <div className="flex items-center gap-3">
                {selectedLead ? (
                  <LeadAvatar lead={selectedLead} size="md" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 font-display text-lg font-semibold text-barney">
                    {selected.leadName.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-ink">{selected.leadName}</h2>
                  <p className="truncate text-sm text-muted">
                    {selectedLead?.company || selectedLead?.position
                      ? [selectedLead.position, selectedLead.company].filter(Boolean).join(" · ")
                      : selected.campaignName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-barney">{selected.campaignName}</p>
                </div>
              </div>
            </header>
            <ol
              ref={threadScrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-5"
            >
              {bubbles.map((message) => {
                const inbound = message.direction === "inbound";
                return (
                  <li
                    key={message.id}
                    className={cn("group flex items-end gap-1.5", inbound ? "justify-start" : "justify-end")}
                  >
                    {!inbound ? (
                      <button
                        type="button"
                        aria-label={t("remove.action")}
                        disabled={!canCompose || deleting}
                        onClick={() => {
                          setSendError("");
                          setPendingDelete(message);
                        }}
                        className="mb-5 rounded-lg p-1.5 text-muted opacity-100 transition-opacity hover:bg-canvas hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <div className={cn("flex max-w-[78%] flex-col", inbound ? "items-start" : "items-end")}>
                      <div
                        className={cn(
                          "px-3.5 py-2.5 text-sm leading-6",
                          inbound
                            ? "rounded-2xl rounded-bl-md bg-canvas text-ink"
                            : "rounded-2xl rounded-br-md bg-barney text-white",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                      </div>
                      {message.reactions.length > 0 ? (
                        <span className="-mt-2 rounded-full border border-purple-jam/10 bg-white px-1.5 py-0.5 text-sm shadow-sm">
                          {message.reactions.join(" ")}
                        </span>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted">
                        {formatLastAction(message.sentAt, now, locale)}
                      </p>
                    </div>
                  </li>
                );
              })}
              <li ref={threadEndRef} aria-hidden className="h-0" />
            </ol>
            <form
              className="shrink-0 border-t border-purple-jam/8 bg-white px-5 py-3"

              onSubmit={(event) => {
                event.preventDefault();
                void submitDraft();
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  disabled={sending || !canCompose}
                  rows={2}
                  placeholder={t("composePlaceholder")}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((current) => ({ ...current, [selected.leadId]: value }));
                    if (sendError) setSendError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitDraft();
                    }
                  }}
                  className="min-h-11 max-h-32 flex-1 resize-none rounded-xl border border-purple-jam/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-barney/40 disabled:bg-canvas disabled:text-muted"
                />
                <Button
                  type="submit"
                  disabled={sending || !canCompose || !draft.trim()}
                  className="h-11 shrink-0 px-3"
                  aria-label={t("send")}
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">{sending ? t("sending") : t("send")}</span>
                </Button>
              </div>
              <p className={cn("mt-2 text-[11px]", sendError ? "text-rose-600" : "text-muted")}>
                {sendError ||
                  (!canCompose && selectedBrand?.testMode
                    ? t("sendTestMode")
                    : !canCompose && (selectedBrand?.outreachPaused || selectedBrand?.archived)
                      ? t("sendPaused")
                      : !canCompose
                        ? t("sendSeat")
                        : t("composeHint"))}
              </p>
            </form>
          </>
        ) : (
          <p className="m-auto px-6 text-sm text-muted">{common("empty")}</p>
        )}
      </section>
      <Modal
        open={Boolean(pendingDelete)}
        title={t("remove.title")}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        variant="light"
      >
        <p className="text-sm leading-6 text-muted">{t("remove.hint")}</p>
        {pendingDelete ? (
          <p className="mt-3 line-clamp-4 rounded-xl bg-canvas px-3 py-2 text-sm text-ink">
            {pendingDelete.body}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="light" disabled={deleting} onClick={() => setPendingDelete(null)}>
            {common("cancel")}
          </Button>
          <Button
            className="bg-rose-600 text-white hover:opacity-90"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? t("remove.pending") : t("remove.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

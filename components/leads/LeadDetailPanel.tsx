"use client";

import { useLayoutEffect, useRef, type WheelEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Eye, Mail, MessageCircle, Phone, Send, UserPlus, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { flowStepTitle } from "@/lib/campaign-flow";
import { isLeadFlowTerminal } from "@/lib/leads";
import { humanizeFailReason } from "@/lib/fail-reason";
import { leadNextFlowStep, leadStatusLabel } from "@/lib/lead-status";
import { displayLeadCompany } from "@/lib/linkedin-company";
import { EMPTY_METRIC, cn, formatDateTime } from "@/lib/utils";
import type { Campaign, Lead, LeadEventKind } from "@/types";

function linkedinHost(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "");
}

const HISTORY_ICON: Record<LeadEventKind, LucideIcon> = {
  added: UserPlus,
  profile_viewed: Eye,
  connection_sent: Users,
  accepted: Check,
  message_1_sent: Send,
  message_2_sent: Send,
  message_3_sent: Send,
  inmail_sent: Mail,
  replied: MessageCircle,
  failed: AlertTriangle,
};

const HISTORY_TONE: Record<LeadEventKind, "green" | "purple" | "red"> = {
  added: "green",
  profile_viewed: "purple",
  connection_sent: "purple",
  accepted: "green",
  message_1_sent: "purple",
  message_2_sent: "purple",
  message_3_sent: "purple",
  inmail_sent: "purple",
  replied: "green",
  failed: "red",
};

export function LeadDetailPanel({
  lead,
  campaign,
  campaignName,
  onClose,
}: {
  lead: Lead;
  campaign?: Campaign;
  campaignName?: string;
  onClose: () => void;
}) {
  const t = useTranslations("campaigns.leads");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const stageT = useTranslations("stage");
  const locale = useLocale();

  const historyLabel: Record<LeadEventKind, string> = {
    added: t("historyAdded"),
    profile_viewed: t("historyViewed"),
    connection_sent: t("historySent"),
    accepted: t("historyAccepted"),
    message_1_sent: t("historyMessage"),
    message_2_sent: t("historyMessage2"),
    message_3_sent: t("historyMessage3"),
    inmail_sent: t("historyInmail"),
    replied: t("historyReply"),
    failed: t("historyFailed"),
  };

  const campaignEnded = campaign?.status === "completed" && !isLeadFlowTerminal(lead);
  const nextStep = campaign && !campaignEnded ? leadNextFlowStep(lead, campaign) : null;
  const nextTitle = nextStep ? flowStepTitle(nextStep, locale) : "";
  const historyRef = useRef<HTMLDivElement>(null);
  const historyKey = lead.history.map((item) => `${item.kind}-${item.at.toISOString()}`).join("|");

  useLayoutEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lead.id, historyKey]);

  const onHistoryWheel = (event: WheelEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const maxScroll = node.scrollHeight - node.clientHeight;
    if (maxScroll > 1) {
      const atTop = node.scrollTop <= 0 && event.deltaY < 0;
      const atBottom = node.scrollTop >= maxScroll - 1 && event.deltaY > 0;
      if (!atTop && !atBottom) return;
    }
    const page = node.closest("main");
    if (!page) return;
    page.scrollTop += event.deltaY;
    event.preventDefault();
  };

  return (
    <aside className="surface-card flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <LeadAvatar lead={lead} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold leading-snug text-ink">{lead.fullName}</h2>
          <p className="wrap-break-word text-sm text-muted">{lead.position || EMPTY_METRIC}</p>
          <p className="wrap-break-word text-sm text-muted">{displayLeadCompany(lead) || EMPTY_METRIC}</p>
          {campaignName ? <p className="text-sm text-muted">{campaignName}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <StageBadge
              stage={campaignEnded ? "pending" : lead.stage}
              label={campaignEnded ? stageT("campaign_ended") : stageT(lead.stage)}
            />
            <StatusBadge
              plain
              status={campaignEnded ? "completed" : lead.status}
              label={leadStatusLabel(lead, {
                campaign,
                locale,
                t: statusT,
              })}
            />
          </div>
        </div>
        <button
          type="button"
          aria-label={common("close")}
          onClick={onClose}
          className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {lead.failReason || nextTitle || (lead.nextStepAt && !campaignEnded) ? (
        <section className="mt-5 shrink-0 rounded-xl border border-purple-jam/10 bg-canvas px-3 py-3">
          {lead.failReason ? (
            <p className="text-sm text-rose-700">
              <span className="font-medium">{t("failReason")}: </span>
              {humanizeFailReason(lead.failReason, locale)}
            </p>
          ) : null}
          {nextTitle && lead.status !== "failed" && lead.status !== "replied" ? (
            <p className="text-sm text-ink">
              <span className="font-medium text-muted">{t("nextStep")}: </span>
              {nextTitle}
            </p>
          ) : null}
          {lead.nextStepAt && !campaignEnded && lead.status !== "failed" && lead.status !== "replied" ? (
            <p className="mt-1 text-sm text-muted">
              {t("scheduledFor")}: {formatDateTime(lead.nextStepAt, locale)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 shrink-0">
        <h3 className="font-display text-sm font-semibold text-ink">{t("contact")}</h3>
        <div className="mt-2 border-t border-purple-jam/10 pt-3">
          <ul className="space-y-2.5 text-sm text-ink">
            {lead.email ? (
              <li className="flex min-w-0 items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-barney" />
                <span className="min-w-0 truncate">{lead.email}</span>
              </li>
            ) : null}
            {lead.phone ? (
              <li className="flex min-w-0 items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-barney" />
                <span className="min-w-0 wrap-break-word">{lead.phone}</span>
              </li>
            ) : null}
            <li className="flex min-w-0 items-start gap-2.5">
              <LinkedInIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <a
                href={lead.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 wrap-anywhere hover:text-barney sm:truncate sm:whitespace-nowrap"
              >
                {linkedinHost(lead.linkedinUrl)}
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section
        className="mt-6 flex min-h-0 flex-1 flex-col"
        onWheel={(event) => {
          if (event.target !== event.currentTarget) return;
          const page = event.currentTarget.closest("main");
          if (!page) return;
          page.scrollTop += event.deltaY;
          event.preventDefault();
        }}
      >
        <h3 className="shrink-0 font-display text-sm font-semibold text-ink">{t("history")}</h3>
        <div
          className="mt-2 min-h-0 overflow-y-auto border-t border-purple-jam/10 pt-3 [scrollbar-width:thin]"
          ref={historyRef}
          onWheel={onHistoryWheel}
        >
            <div className="relative">
            {lead.history.length > 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute left-[15px] top-4 bottom-4 border-l border-barney/20"
              />
            ) : null}
            <ol className="space-y-2.5">
            {lead.history.map((item) => {
              const Icon = HISTORY_ICON[item.kind];
              const tone = HISTORY_TONE[item.kind];
              return (
                <li
                  key={`${item.kind}-${item.at.toISOString()}`}
                  className="relative flex items-center gap-3"
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center bg-white",
                      tone === "green" && "text-emerald-600",
                      tone === "purple" && "text-barney",
                      tone === "red" && "text-rose-600",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p className="min-w-0 text-sm font-medium text-ink">{historyLabel[item.kind]}</p>
                      <p className="text-xs text-muted sm:shrink-0 sm:whitespace-nowrap">
                        {formatDateTime(item.at, locale)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
            </ol>
            </div>
        </div>
      </section>
    </aside>
  );
}

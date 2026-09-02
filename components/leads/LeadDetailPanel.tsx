"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Eye, Mail, MessageCircle, Phone, Send, UserPlus, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { flowStepTitle } from "@/lib/campaign-flow";
import { leadStatusLabelKey } from "@/lib/leads";
import { findStep } from "@/lib/sequence";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
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

  const inset = `${100 / (Math.max(lead.history.length, 1) * 2)}%`;
  const nextStep = campaign ? findStep(campaign.flow, lead.nextStepId) : null;
  const nextTitle = nextStep ? flowStepTitle(nextStep, locale) : "";

  return (
    <aside className="surface-card flex h-full min-h-0 flex-col rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <LeadAvatar lead={lead} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold leading-snug text-ink">{lead.fullName}</h2>
          <p className="text-sm text-muted">{lead.position}</p>
          <p className="text-sm text-muted">{lead.company}</p>
          {campaignName ? <p className="text-sm text-muted">{campaignName}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <StageBadge stage={lead.stage} label={stageT(lead.stage)} />
            <StatusBadge status={lead.status} label={statusT(leadStatusLabelKey(lead))} />
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

      {lead.failReason || nextTitle || lead.nextStepAt ? (
        <section className="mt-5 shrink-0 rounded-xl border border-purple-jam/10 bg-canvas px-3 py-3">
          {lead.failReason ? (
            <p className="text-sm text-rose-700">
              <span className="font-medium">{t("failReason")}: </span>
              {lead.failReason}
            </p>
          ) : null}
          {nextTitle && lead.status !== "failed" && lead.status !== "replied" ? (
            <p className="text-sm text-ink">
              <span className="font-medium text-muted">{t("nextStep")}: </span>
              {nextTitle}
            </p>
          ) : null}
          {lead.nextStepAt && lead.status !== "failed" && lead.status !== "replied" ? (
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
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-barney" />
              <span className="truncate">{lead.email}</span>
            </li>
            {lead.phone ? (
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-barney" />
                <span>{lead.phone}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-2.5">
              <LinkedInIcon className="h-4 w-4 shrink-0" />
              <a
                href={lead.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-barney"
              >
                {linkedinHost(lead.linkedinUrl)}
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-6 flex min-h-0 flex-1 flex-col">
        <h3 className="shrink-0 font-display text-sm font-semibold text-ink">{t("history")}</h3>
        <div className="relative mt-2 min-h-0 flex-1 border-t border-purple-jam/10 pt-1">
          <span
            aria-hidden
            className="pointer-events-none absolute left-[15px] border-l border-barney/20"
            style={{ top: inset, bottom: inset }}
          />
          <ol className="flex h-full flex-col">
            {lead.history.map((item) => {
              const Icon = HISTORY_ICON[item.kind];
              const tone = HISTORY_TONE[item.kind];
              return (
                <li key={`${item.kind}-${item.at.toISOString()}`} className="relative flex min-h-0 flex-1 items-center gap-3 pl-0">
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      tone === "green" && "bg-emerald-50 text-emerald-600",
                      tone === "purple" && "bg-violet-50 text-barney",
                      tone === "red" && "bg-rose-50 text-rose-600",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{historyLabel[item.kind]}</p>
                      <p className="shrink-0 whitespace-nowrap text-xs text-muted">
                        {formatDateTime(item.at, locale)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </aside>
  );
}

"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Mail, MessageCircle, Phone, Send, UserPlus, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime, personInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Lead, LeadEventKind } from "@/types";

const AVATAR = [
  "bg-barney text-white",
  "bg-violet-100 text-barney",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
];

function avatarClass(id: string) {
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR[index % AVATAR.length];
}

function linkedinHost(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "");
}

export function leadAvatarClass(id: string) {
  return avatarClass(id);
}

const HISTORY_ICON: Record<LeadEventKind, LucideIcon> = {
  added: UserPlus,
  connection_sent: Users,
  accepted: Check,
  message_1_sent: Send,
  message_2_sent: Send,
  message_3_sent: Send,
  replied: MessageCircle,
  failed: AlertTriangle,
};

const HISTORY_TONE: Record<LeadEventKind, "green" | "purple" | "red"> = {
  added: "green",
  connection_sent: "purple",
  accepted: "green",
  message_1_sent: "purple",
  message_2_sent: "purple",
  message_3_sent: "purple",
  replied: "green",
  failed: "red",
};

export function LeadDetailPanel({
  lead,
  campaignName,
  onClose,
}: {
  lead: Lead;
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
    connection_sent: t("historySent"),
    accepted: t("historyAccepted"),
    message_1_sent: t("historyMessage"),
    message_2_sent: t("historyMessage2"),
    message_3_sent: t("historyMessage3"),
    replied: t("historyReply"),
    failed: t("historyFailed"),
  };

  const inset = `${100 / (Math.max(lead.history.length, 1) * 2)}%`;

  return (
    <aside className="surface-card flex h-full min-h-0 flex-col rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold",
            avatarClass(lead.id),
          )}
        >
          {personInitials(lead.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold leading-snug text-ink">{lead.fullName}</h2>
          <p className="text-sm text-muted">{lead.position}</p>
          <p className="text-sm text-muted">{lead.company}</p>
          {campaignName ? <p className="text-sm text-muted">{campaignName}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <StageBadge stage={lead.stage} label={stageT(lead.stage)} />
            <StatusBadge status={lead.status} label={statusT(lead.status)} />
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

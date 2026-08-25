"use client";

import type { LucideIcon } from "lucide-react";
import { Check, Mail, MessageCircle, Phone, Send, UserPlus, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LinkedInIcon } from "@/components/brand/LinkedInIcon";
import { StageBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime, personInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

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

function shiftMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function linkedinHost(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "");
}

export function leadAvatarClass(id: string) {
  return avatarClass(id);
}

export function CampaignLeadPanel({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const t = useTranslations("campaigns.leads");
  const common = useTranslations("common");
  const statusT = useTranslations("status");
  const stageT = useTranslations("stage");
  const locale = useLocale();

  const sent = lead.lastMessageSentAt;
  const history: {
    id: string;
    label: string;
    at: Date;
    icon: LucideIcon;
    tone: "green" | "purple";
    quote?: string;
  }[] = [
    {
      id: "added",
      label: t("historyAdded"),
      at: shiftMinutes(sent, -6),
      icon: UserPlus,
      tone: "green",
    },
    {
      id: "sent",
      label: t("historySent"),
      at: shiftMinutes(sent, -5),
      icon: Users,
      tone: "purple",
    },
  ];

  if (lead.stage !== "failed") {
    history.push({
      id: "accepted",
      label: t("historyAccepted"),
      at: shiftMinutes(sent, -3),
      icon: Check,
      tone: "green",
    });
    history.push({
      id: "message",
      label: t("historyMessage"),
      at: sent,
      icon: Send,
      tone: "purple",
    });
  }

  if (lead.firstReplyReceivedAt) {
    history.push({
      id: "reply",
      label: t("historyReply"),
      at: lead.firstReplyReceivedAt,
      icon: MessageCircle,
      tone: "green",
      quote: t("historyReplyQuote"),
    });
  }

  const inset = `${100 / (Math.max(history.length, 1) * 2)}%`;

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
          <h2 className="truncate font-display text-lg font-semibold text-ink">{lead.fullName}</h2>
          <p className="text-sm text-muted">{lead.position}</p>
          <p className="text-sm text-muted">{lead.company}</p>
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
            {history.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="relative flex min-h-0 flex-1 items-center gap-3 pl-0">
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      item.tone === "green"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-violet-50 text-barney",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{item.label}</p>
                      <p className="shrink-0 whitespace-nowrap text-xs text-muted">
                        {formatDateTime(item.at, locale)}
                      </p>
                    </div>
                    {item.quote ? (
                      <p className="mt-0.5 text-xs leading-4 text-muted">{item.quote}</p>
                    ) : null}
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

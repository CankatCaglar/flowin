"use client";

import { AlertTriangle, ChevronRight, Clock, MessageSquareWarning, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function AttentionList({
  unresponsiveCount,
  expiringCount,
  lowResponseCount,
  followUpCount,
}: {
  unresponsiveCount: number;
  expiringCount: number;
  lowResponseCount: number;
  followUpCount: number;
}) {
  const t = useTranslations("dashboard.attention");

  const items = [
    {
      href: "/leads?status=waiting_reply",
      label: t("unresponsive"),
      hint: t("unresponsiveHint", { count: unresponsiveCount }),
      icon: MessageSquareWarning,
      iconClass: "text-orange-600",
    },
    {
      href: "/campaigns",
      label: t("expiring"),
      hint: t("expiringHint", { count: expiringCount }),
      icon: Clock,
      iconClass: "text-rose-600",
    },
    {
      href: "/campaigns",
      label: t("lowResponse"),
      hint: t("lowResponseHint", { count: lowResponseCount }),
      icon: AlertTriangle,
      iconClass: "text-barney",
    },
    {
      href: "/leads?status=queued",
      label: t("followUp"),
      hint: t("followUpHint", { count: followUpCount }),
      icon: UserRound,
      iconClass: "text-sky-700",
    },
  ];

  return (
    <article className="surface-card h-full rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{t("title")}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-purple-jam/10 bg-white px-3 py-3"
            >
              <Icon className={`h-4 w-4 shrink-0 ${item.iconClass}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          );
        })}
      </div>
    </article>
  );
}

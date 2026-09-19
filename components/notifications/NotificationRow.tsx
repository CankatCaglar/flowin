"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Gauge,
  MessageCircle,
  PauseCircle,
  Smile,
  Unlink,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn, formatRelativeShort } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";

const ICONS: Record<NotificationType, { Icon: LucideIcon; wrap: string; icon: string }> = {
  new_reply: { Icon: MessageCircle, wrap: "bg-emerald-50", icon: "text-emerald-600" },
  reaction: { Icon: Smile, wrap: "bg-rose-50", icon: "text-rose-500" },
  linkedin_disconnected: { Icon: Unlink, wrap: "bg-pink-50", icon: "text-pink-500" },
  lead_failed: { Icon: AlertTriangle, wrap: "bg-orange-50", icon: "text-orange-500" },
  leads_failed: { Icon: AlertTriangle, wrap: "bg-orange-50", icon: "text-orange-500" },
  campaign_paused_error: { Icon: PauseCircle, wrap: "bg-red-50", icon: "text-red-500" },
  campaign_empty: { Icon: Flag, wrap: "bg-barney/10", icon: "text-barney" },
  daily_cap: { Icon: Gauge, wrap: "bg-sky-50", icon: "text-sky-600" },
  campaign_completed: { Icon: CheckCircle2, wrap: "bg-emerald-50", icon: "text-emerald-600" },
};

export function NotificationRow({
  item,
  onOpen,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const visual = ICONS[item.type];
  const unread = !item.readAt;
  const now = new Date();
  const capKind = String(item.params.limit ?? "all");
  const capLimit =
    item.type === "daily_cap"
      ? t(
          `types.daily_cap.limits.${
            ["views", "invites", "messages", "inmails"].includes(capKind) ? capKind : "all"
          }`,
        )
      : "";
  const capParams = { ...item.params, limit: capLimit };

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-canvas"
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", visual.wrap)}>
        <visual.Icon className={cn("h-4 w-4", visual.icon)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-ink">
            {item.type === "daily_cap" ? t("types.daily_cap.title", capParams) : t(`types.${item.type}.title`)}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted">{formatRelativeShort(item.createdAt, now, locale)}</span>
            {unread ? <span className="h-1.5 w-1.5 rounded-full bg-barney" /> : null}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">
          {item.type === "daily_cap" ? t("types.daily_cap.body", capParams) : t(`types.${item.type}.body`, item.params)}
        </span>
      </span>
    </button>
  );
}

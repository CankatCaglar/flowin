"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { AnchoredMenu } from "@/components/ui/SelectMenu";
import { useBrand } from "@/contexts/BrandContext";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { Link, useRouter } from "@/i18n/navigation";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const { selectedBrand } = useBrand();
  const router = useRouter();
  const { open, toggle, close } = useMenu("notifications");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const brandId = selectedBrand?.id ?? "";

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    const refresh = () =>
      fetchNotifications(brandId)
        .then((data) => {
          if (!cancelled) setItems(data.items);
        })
        .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [brandId]);

  const unreadCount = items.filter((item) => !item.readAt).length;
  const visible = tab === "unread" ? items.filter((item) => !item.readAt) : items;
  const preview = visible.slice(0, 6);

  const openItem = async (item: AppNotification) => {
    close();
    if (!item.readAt && brandId) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, readAt: new Date() } : row)),
      );
      void markNotificationRead(brandId, item.id).catch(() => undefined);
    }
    router.push(item.href);
  };

  const markAll = async () => {
    if (!brandId || unreadCount === 0) return;
    setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt ?? new Date() })));
    await markAllNotificationsRead(brandId).catch(() => undefined);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={t("open")}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-jam/15 bg-white text-ink hover:bg-canvas"
      >
        <Bell className="h-4 w-4 text-barney" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={rootRef}
        align="right"
        compact
        panelRef={panelRef}
        className="w-[22.5rem] overflow-hidden p-0 sm:w-[24rem]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-purple-jam/10 px-4 py-3">
          <p className="font-display text-sm font-semibold text-ink">{t("title")}</p>
          <button
            type="button"
            onClick={() => void markAll()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t("markAll")}
          </button>
        </div>
        <div className="flex gap-2 px-4 py-2.5">
          {(
            [
              ["all", t("all", { count: items.length })],
              ["unread", t("unread", { count: unreadCount })],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                tab === id ? "bg-barney/10 text-barney" : "text-muted hover:bg-canvas",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-80 overflow-y-auto [scrollbar-width:thin]">
          {preview.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              {tab === "unread" ? t("emptyUnread") : t("empty")}
            </p>
          ) : (
            preview.map((item) => (
              <NotificationRow key={item.id} item={item} onOpen={openItem} />
            ))
          )}
        </div>
        <div className="border-t border-purple-jam/10 px-4 py-2.5 text-center">
          <Link
            href="/notifications"
            onClick={close}
            className="text-xs font-semibold text-barney hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
      </AnchoredMenu>
    </div>
  );
}

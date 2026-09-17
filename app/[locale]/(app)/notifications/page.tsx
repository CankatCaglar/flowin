"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useBrand } from "@/contexts/BrandContext";
import { useRouter } from "@/i18n/navigation";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const { selectedBrand } = useBrand();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const brandId = selectedBrand?.id ?? "";

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    void fetchNotifications(brandId)
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const unreadCount = items.filter((item) => !item.readAt).length;
  const visible = tab === "unread" ? items.filter((item) => !item.readAt) : items;

  const openItem = async (item: AppNotification) => {
    if (!item.readAt && brandId) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, readAt: new Date() } : row)),
      );
      void markNotificationRead(brandId, item.id).catch(() => undefined);
    }
    router.push(item.href);
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("pageSubtitle")}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt ?? new Date() })));
                if (brandId) void markAllNotificationsRead(brandId).catch(() => undefined);
              }}
              className="text-sm font-medium text-barney hover:underline"
            >
              {t("markAll")}
            </button>
          ) : null
        }
      />
      <div className="mb-4 flex gap-2">
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
              "rounded-full px-3 py-1.5 text-sm font-medium",
              tab === id ? "bg-barney/10 text-barney" : "text-muted hover:bg-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && items.length === 0 ? (
        <PageSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">{tab === "unread" ? t("emptyUnread") : t("empty")}</p>
      ) : (
        <div className="surface-card divide-y divide-purple-jam/8 overflow-hidden rounded-2xl">
          {visible.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={openItem} />
          ))}
        </div>
      )}
    </div>
  );
}

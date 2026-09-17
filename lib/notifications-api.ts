import type { AppNotification } from "@/types";

function hydrateNotification(row: AppNotification): AppNotification {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    readAt: row.readAt ? (row.readAt instanceof Date ? row.readAt : new Date(row.readAt)) : null,
    emailDueAt: row.emailDueAt
      ? row.emailDueAt instanceof Date
        ? row.emailDueAt
        : new Date(row.emailDueAt)
      : undefined,
    emailSentAt: row.emailSentAt
      ? row.emailSentAt instanceof Date
        ? row.emailSentAt
        : new Date(row.emailSentAt)
      : undefined,
    resolvedAt: row.resolvedAt
      ? row.resolvedAt instanceof Date
        ? row.resolvedAt
        : new Date(row.resolvedAt)
      : null,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "request-failed";
    throw new Error(error);
  }
  return data as T;
}

export async function fetchNotifications(brandId: string) {
  const response = await fetch(`/api/notifications?brandId=${encodeURIComponent(brandId)}`);
  const data = await readJson<{ items: AppNotification[]; unreadCount: number }>(response);
  return {
    items: data.items.map(hydrateNotification),
    unreadCount: data.unreadCount,
  };
}

export async function markNotificationRead(brandId: string, id: string) {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, id }),
  });
  await readJson<{ ok: boolean }>(response);
}

export async function markAllNotificationsRead(brandId: string) {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, all: true }),
  });
  await readJson<{ ok: boolean }>(response);
}

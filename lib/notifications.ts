import "server-only";
import { Timestamp, type DocumentData, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { fetchBrand } from "@/lib/data";
import { requireFirebaseDb } from "@/lib/firebase";
import { isLeadFlowTerminal } from "@/lib/leads";
import { leadNeedsOurReply } from "@/lib/chat-thread";
import { notificationAppUrl, notificationRecipient, sendNotificationEmail } from "@/lib/mail";
import { isCampaignRunning } from "@/lib/campaign-status";
import { humanizeFailReason } from "@/lib/fail-reason";
import { istanbulDateKey } from "@/lib/pacing";
import type {
  AppNotification,
  Brand,
  Campaign,
  Lead,
  NotificationEmailStatus,
  NotificationType,
} from "@/types";

const COLLECTION = "notifications";
const REPLY_WAIT_MS = 3 * 24 * 60 * 60 * 1000;

const EMAIL_POLICY: Record<NotificationType, "none" | "instant" | "delayed"> = {
  new_reply: "delayed",
  reaction: "none",
  linkedin_disconnected: "instant",
  lead_failed: "instant",
  leads_failed: "instant",
  campaign_paused_error: "instant",
  campaign_empty: "none",
  daily_cap: "none",
  campaign_completed: "none",
};

const EMAIL_COPY: Record<
  NotificationType,
  { subject: string; body: (params: AppNotification["params"]) => string } | null
> = {
  new_reply: {
    subject: "Yanıt bekleyen mesajınız var",
    body: (params) => `${params.leadName}’dan gelen mesaj 3 gündür bekliyor.`,
  },
  reaction: null,
  linkedin_disconnected: {
    subject: "LinkedIn Bağlantısı Kesildi",
    body: (params) =>
      `${params.brandName} profilinin LinkedIn bağlantısı kesildi. Aktif işlemler devam edemiyor.`,
  },
  lead_failed: {
    subject: "Lead İşlenemedi",
    body: (params) =>
      `${params.leadName} için işlem tamamlanamadı.\n${params.campaignName} · ${params.brandName}${
        params.reason ? `\n${params.reason}` : ""
      }`,
  },
  leads_failed: {
    subject: "Birden Fazla Lead İşlenemedi",
    body: (params) =>
      `${params.campaignName} kampanyasında ${params.count} lead için işlem tamamlanamadı.`,
  },
  campaign_paused_error: {
    subject: "Kampanya Durduruldu",
    body: (params) => `${params.campaignName} teknik bir hata nedeniyle durduruldu.`,
  },
  campaign_empty: null,
  daily_cap: null,
  campaign_completed: null,
};

function asDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

function asOptionalDate(value: unknown) {
  if (value == null || value === "") return undefined;
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asEmailStatus(value: unknown): NotificationEmailStatus {
  if (value === "scheduled" || value === "sent" || value === "canceled" || value === "none") {
    return value;
  }
  return "none";
}

function asType(value: unknown): NotificationType | null {
  const types: NotificationType[] = [
    "new_reply",
    "reaction",
    "linkedin_disconnected",
    "lead_failed",
    "leads_failed",
    "campaign_paused_error",
    "campaign_empty",
    "daily_cap",
    "campaign_completed",
  ];
  return types.includes(value as NotificationType) ? (value as NotificationType) : null;
}

function hydrateNotification(id: string, data: DocumentData): AppNotification | null {
  const type = asType(data.type);
  if (!type) return null;
  const paramsRaw = data.params && typeof data.params === "object" ? data.params : {};
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(paramsRaw as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") params[key] = value;
  }
  return {
    id,
    brandId: String(data.brandId ?? ""),
    type,
    href: String(data.href ?? "/dashboard"),
    leadId: String(data.leadId ?? "") || undefined,
    campaignId: String(data.campaignId ?? "") || undefined,
    messageId: String(data.messageId ?? "") || undefined,
    params,
    readAt: asOptionalDate(data.readAt) ?? null,
    createdAt: asDate(data.createdAt),
    email: asEmailStatus(data.email),
    emailDueAt: asOptionalDate(data.emailDueAt),
    emailSentAt: asOptionalDate(data.emailSentAt),
    dedupeKey: String(data.dedupeKey ?? ""),
    resolvedAt: asOptionalDate(data.resolvedAt) ?? null,
  };
}

async function findOpenByDedupe(dedupeKey: string) {
  const snapshot = await requireFirebaseDb()
    .collection(COLLECTION)
    .where("dedupeKey", "==", dedupeKey)
    .limit(8)
    .get();
  return snapshot.docs
    .map((doc) => hydrateNotification(doc.id, doc.data()))
    .find((item) => item && !item.resolvedAt) ?? null;
}

type EmitInput = {
  brandId: string;
  type: NotificationType;
  href: string;
  dedupeKey: string;
  params: Record<string, string | number>;
  leadId?: string;
  campaignId?: string;
  messageId?: string;
};

export async function emitNotification(input: EmitInput) {
  if (await findOpenByDedupe(input.dedupeKey)) return null;
  const now = new Date();
  const policy = EMAIL_POLICY[input.type];
  const email: NotificationEmailStatus =
    policy === "instant" ? "sent" : policy === "delayed" ? "scheduled" : "none";
  const emailDueAt = policy === "delayed" ? new Date(now.getTime() + REPLY_WAIT_MS) : undefined;
  const db = requireFirebaseDb();
  const ref = db.collection(COLLECTION).doc();
  const payload = {
    brandId: input.brandId,
    type: input.type,
    href: input.href,
    leadId: input.leadId ?? "",
    campaignId: input.campaignId ?? "",
    messageId: input.messageId ?? "",
    params: input.params,
    readAt: null,
    createdAt: Timestamp.fromDate(now),
    email,
    emailDueAt: emailDueAt ? Timestamp.fromDate(emailDueAt) : null,
    emailSentAt: policy === "instant" ? Timestamp.fromDate(now) : null,
    dedupeKey: input.dedupeKey,
    resolvedAt: null,
  };
  await ref.create(payload);
  const notification = hydrateNotification(ref.id, {
    ...payload,
    createdAt: now,
    emailDueAt,
    emailSentAt: policy === "instant" ? now : null,
  });
  if (policy === "instant" && notification) {
    const sent = await deliverNotificationEmail(notification);
    if (!sent) {
      await ref.update({ email: "scheduled", emailDueAt: Timestamp.fromDate(now), emailSentAt: null });
    }
  }
  return notification;
}

async function deliverNotificationEmail(notification: AppNotification) {
  const copy = EMAIL_COPY[notification.type];
  if (!copy) return true;
  const brand = await fetchBrand(notification.brandId);
  const to = notificationRecipient(brand?.linkedinEmail);
  if (!to) {
    console.error("[notifications] brand has no linkedinEmail:", notification.brandId);
    return false;
  }
  const result = await sendNotificationEmail({
    to,
    subject: copy.subject,
    body: copy.body(notification.params),
    url: notificationAppUrl(notification.href),
  });
  return result.ok;
}

export async function fetchNotifications(brandId: string, limit = 80) {
  const col = requireFirebaseDb().collection(COLLECTION);
  try {
    const snapshot = await col.where("brandId", "==", brandId).orderBy("createdAt", "desc").limit(limit).get();
    return snapshot.docs
      .map((doc) => hydrateNotification(doc.id, doc.data()))
      .filter((item): item is AppNotification => Boolean(item));
  } catch (error) {
    console.error("[notifications] list index missing, falling back:", error instanceof Error ? error.message : error);
    const snapshot = await col.where("brandId", "==", brandId).get();
    return snapshot.docs
      .map((doc) => hydrateNotification(doc.id, doc.data()))
      .filter((item): item is AppNotification => Boolean(item))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export async function markNotificationsRead(input: {
  brandId: string;
  id?: string;
  all?: boolean;
}) {
  const db = requireFirebaseDb();
  const now = Timestamp.now();
  if (input.id) {
    const ref = db.collection(COLLECTION).doc(input.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return;
    const row = hydrateNotification(snapshot.id, snapshot.data() ?? {});
    if (!row || row.brandId !== input.brandId) return;
    const patch: Record<string, unknown> = { readAt: now };
    if (row.email === "scheduled") patch.email = "canceled";
    await ref.update(patch);
    return;
  }
  if (!input.all) return;
  const col = db.collection(COLLECTION);
  let docs: QueryDocumentSnapshot[] = [];
  try {
    const snapshot = await col.where("brandId", "==", input.brandId).where("readAt", "==", null).get();
    docs = snapshot.docs;
  } catch {
    const snapshot = await col.where("brandId", "==", input.brandId).get();
    docs = snapshot.docs.filter((doc) => !hydrateNotification(doc.id, doc.data())?.readAt);
  }
  const batch = db.batch();
  let writes = 0;
  for (const doc of docs) {
    const row = hydrateNotification(doc.id, doc.data());
    if (!row || row.readAt) continue;
    const patch: Record<string, unknown> = { readAt: now };
    if (row.email === "scheduled") patch.email = "canceled";
    batch.update(doc.ref, patch);
    writes += 1;
  }
  if (writes) await batch.commit();
}

export async function markLeadNotificationsSeen(brandId: string, leadId: string) {
  const snapshot = await requireFirebaseDb()
    .collection(COLLECTION)
    .where("brandId", "==", brandId)
    .where("leadId", "==", leadId)
    .get();
  const now = Timestamp.now();
  const db = requireFirebaseDb();
  const batch = db.batch();
  let writes = 0;
  for (const doc of snapshot.docs) {
    const row = hydrateNotification(doc.id, doc.data());
    if (!row || row.readAt) continue;
    const patch: Record<string, unknown> = { readAt: now };
    if (row.email === "scheduled") patch.email = "canceled";
    batch.update(doc.ref, patch);
    writes += 1;
  }
  if (writes) await batch.commit();
}

export async function cancelScheduledReplyEmail(brandId: string, leadId: string) {
  const snapshot = await requireFirebaseDb()
    .collection(COLLECTION)
    .where("brandId", "==", brandId)
    .where("leadId", "==", leadId)
    .get();
  const db = requireFirebaseDb();
  const batch = db.batch();
  let writes = 0;
  for (const doc of snapshot.docs) {
    const row = hydrateNotification(doc.id, doc.data());
    if (!row || row.type !== "new_reply" || row.email !== "scheduled") continue;
    batch.update(doc.ref, { email: "canceled" });
    writes += 1;
  }
  if (writes) await batch.commit();
}

export async function resolveBrandNotifications(
  brandId: string,
  type: NotificationType,
  campaignId?: string,
) {
  const col = requireFirebaseDb().collection(COLLECTION);
  let docs: QueryDocumentSnapshot[] = [];
  try {
    let query: Query = col.where("brandId", "==", brandId).where("type", "==", type);
    if (campaignId) query = query.where("campaignId", "==", campaignId);
    docs = (await query.get()).docs;
  } catch {
    const snapshot = await col.where("brandId", "==", brandId).get();
    docs = snapshot.docs.filter((doc) => {
      const row = hydrateNotification(doc.id, doc.data());
      if (!row || row.type !== type) return false;
      if (campaignId && row.campaignId !== campaignId) return false;
      return true;
    });
  }
  const now = Timestamp.now();
  const db = requireFirebaseDb();
  const batch = db.batch();
  let writes = 0;
  for (const doc of docs) {
    const row = hydrateNotification(doc.id, doc.data());
    if (!row || row.resolvedAt) continue;
    batch.update(doc.ref, { resolvedAt: now });
    writes += 1;
  }
  if (writes) await batch.commit();
}

export async function drainDueNotificationEmails() {
  const col = requireFirebaseDb().collection(COLLECTION);
  const now = Timestamp.now();
  let docs: QueryDocumentSnapshot[] = [];
  try {
    const snapshot = await col.where("email", "==", "scheduled").where("emailDueAt", "<=", now).limit(40).get();
    docs = snapshot.docs;
  } catch (error) {
    console.error("[notifications] drain index missing, falling back:", error instanceof Error ? error.message : error);
    const snapshot = await col.where("email", "==", "scheduled").limit(80).get();
    const due = now.toMillis();
    docs = snapshot.docs.filter((doc) => {
      const row = hydrateNotification(doc.id, doc.data());
      return Boolean(row?.emailDueAt && row.emailDueAt.getTime() <= due);
    });
  }
  let sent = 0;
  let canceled = 0;
  for (const doc of docs) {
    const notification = hydrateNotification(doc.id, doc.data());
    if (!notification) continue;
    if (notification.readAt) {
      await doc.ref.update({ email: "canceled" });
      canceled += 1;
      continue;
    }
    if (notification.type === "new_reply" && notification.leadId) {
      const { fetchMessagesForLead } = await import("@/lib/outreach-data");
      const messages = await fetchMessagesForLead(notification.leadId);
      if (!leadNeedsOurReply({ id: notification.leadId }, messages)) {
        await doc.ref.update({ email: "canceled" });
        canceled += 1;
        continue;
      }
    }
    const ok = await deliverNotificationEmail(notification);
    if (ok) {
      await doc.ref.update({ email: "sent", emailSentAt: Timestamp.now() });
      sent += 1;
    }
  }
  return { scanned: docs.length, sent, canceled };
}

export async function notifyNewReply(input: {
  brand: Brand;
  lead: Lead;
  campaign: Campaign;
  messageId?: string;
}) {
  await emitNotification({
    brandId: input.brand.id,
    type: "new_reply",
    href: `/messages?lead=${encodeURIComponent(input.lead.id)}`,
    dedupeKey: `new_reply:${input.lead.id}:${input.messageId || Date.now()}`,
    params: {
      leadName: input.lead.fullName,
      campaignName: input.campaign.name,
      brandName: input.brand.name,
    },
    leadId: input.lead.id,
    campaignId: input.campaign.id,
    messageId: input.messageId,
  });
}

export async function notifyReaction(input: {
  brand: Brand;
  lead: Lead;
  campaign: Campaign;
  messageId?: string;
}) {
  await emitNotification({
    brandId: input.brand.id,
    type: "reaction",
    href: `/messages?lead=${encodeURIComponent(input.lead.id)}`,
    dedupeKey: `reaction:${input.lead.id}:${input.messageId || Date.now()}`,
    params: {
      leadName: input.lead.fullName,
      campaignName: input.campaign.name,
      brandName: input.brand.name,
    },
    leadId: input.lead.id,
    campaignId: input.campaign.id,
    messageId: input.messageId,
  });
}

export async function notifyLinkedInDisconnected(brand: Brand) {
  await emitNotification({
    brandId: brand.id,
    type: "linkedin_disconnected",
    href: "/settings",
    dedupeKey: `linkedin_disconnected:${brand.id}`,
    params: { brandName: brand.name },
  });
}

export async function notifyLeadFailed(input: {
  brand: Brand;
  lead: Lead;
  campaign: Campaign;
}) {
  await emitNotification({
    brandId: input.brand.id,
    type: "lead_failed",
    href: `/leads?stage=failed&lead=${encodeURIComponent(input.lead.id)}`,
    dedupeKey: `lead_failed:${input.lead.id}`,
    params: {
      leadName: input.lead.fullName,
      campaignName: input.campaign.name,
      brandName: input.brand.name,
      reason: humanizeFailReason(input.lead.failReason ?? ""),
    },
    leadId: input.lead.id,
    campaignId: input.campaign.id,
  });
}

export async function notifyLeadsFailedBatch(input: {
  brand: Brand;
  campaign: Campaign;
  count: number;
}) {
  await emitNotification({
    brandId: input.brand.id,
    type: "leads_failed",
    href: `/leads?stage=failed&campaign=${encodeURIComponent(input.campaign.id)}`,
    dedupeKey: `leads_failed:${input.campaign.id}:${istanbulDateKey()}`,
    params: {
      campaignName: input.campaign.name,
      brandName: input.brand.name,
      count: input.count,
    },
    campaignId: input.campaign.id,
  });
}

export async function notifyCampaignPausedError(input: { brand: Brand; campaign: Campaign }) {
  await emitNotification({
    brandId: input.brand.id,
    type: "campaign_paused_error",
    href: `/campaigns/${input.campaign.id}`,
    dedupeKey: `campaign_paused:${input.campaign.id}`,
    params: {
      campaignName: input.campaign.name,
      brandName: input.brand.name,
    },
    campaignId: input.campaign.id,
  });
}

export async function notifyDailyCap(brand: Brand, limit: "views" | "invites" | "messages" | "inmails") {
  await emitNotification({
    brandId: brand.id,
    type: "daily_cap",
    href: "/settings",
    dedupeKey: `daily_cap:${brand.id}:${istanbulDateKey()}:${limit}`,
    params: { brandName: brand.name, limit },
  });
}

export async function notifyCampaignCompleted(input: { brand: Brand; campaign: Campaign }) {
  await emitNotification({
    brandId: input.brand.id,
    type: "campaign_completed",
    href: `/campaigns/${input.campaign.id}`,
    dedupeKey: `campaign_completed:${input.campaign.id}`,
    params: {
      campaignName: input.campaign.name,
      brandName: input.brand.name,
    },
    campaignId: input.campaign.id,
  });
}

export async function notifyIfCampaignEmpty(campaignId: string) {
  const { fetchCampaign, fetchLeadsByCampaign } = await import("@/lib/outreach-data");
  const campaign = await fetchCampaign(campaignId);
  if (!campaign || !isCampaignRunning(campaign.status)) return;
  const leads = await fetchLeadsByCampaign(campaignId);
  if (leads.length === 0) return;
  if (leads.some((lead) => !isLeadFlowTerminal(lead))) return;
  const brand = await fetchBrand(campaign.brandId);
  if (!brand) return;
  await emitNotification({
    brandId: brand.id,
    type: "campaign_empty",
    href: `/campaigns/${campaign.id}`,
    dedupeKey: `campaign_empty:${campaign.id}`,
    params: {
      campaignName: campaign.name,
      brandName: brand.name,
    },
    campaignId: campaign.id,
  });
}

export async function onUnipileStatusLost(brand: Brand, status: "disconnected" | "error") {
  if (status === "disconnected") {
    await notifyLinkedInDisconnected(brand);
    return;
  }
  const { fetchCampaigns, updateCampaign } = await import("@/lib/outreach-data");
  const campaigns = await fetchCampaigns(brand.id);
  for (const campaign of campaigns) {
    if (!isCampaignRunning(campaign.status)) continue;
    await updateCampaign(campaign.id, { status: "paused" });
    await notifyCampaignPausedError({ brand, campaign: { ...campaign, status: "paused" } });
  }
}

export async function notifySequenceFailures(
  rows: Array<{ brand: Brand; lead: Lead; campaign: Campaign }>,
) {
  const byCampaign = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCampaign.get(row.campaign.id) ?? [];
    list.push(row);
    byCampaign.set(row.campaign.id, list);
  }
  for (const group of byCampaign.values()) {
    const first = group[0];
    if (!first) continue;
    if (group.length === 1) {
      await notifyLeadFailed(first);
    } else {
      await notifyLeadsFailedBatch({
        brand: first.brand,
        campaign: first.campaign,
        count: group.length,
      });
    }
  }
}

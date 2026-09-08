import "server-only";
import { isReactionNotice } from "@/lib/chat-thread";
import { fetchBrand } from "@/lib/data";
import {
  createMessage,
  deleteMessageDoc,
  fetchCampaign,
  fetchLead,
  fetchMessage,
  fetchMessagesForLead,
  findLeadByChatId,
  findMessageByUnipileId,
  patchMessage,
} from "@/lib/outreach-data";
import {
  aliveUnipileMessages,
  deleteUnipileChatMessage,
  findUnipileMessageId,
  isUnipileMessageDeleted,
  isUnipileReactionItem,
  isUnipileSelfMessage,
  listUnipileChatMessages,
  unipileErrorLooksGone,
  unipileErrorLooksTooOld,
  unipileItemId,
  unipileMessageText,
  unipileMessageTime,
  unipileReactedMessageId,
  unipileReactionEmojis,
  UnipileError,
} from "@/lib/unipile";
import type { Lead, OutreachMessage } from "@/types";

const LINKEDIN_UNSEND_MS = 60 * 60 * 1000;
const MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function chatItems(chatId: string) {
  if (!chatId) return [];
  try {
    return await listUnipileChatMessages(chatId);
  } catch (error) {
    if (unipileErrorLooksGone(error)) return [];
    throw error;
  }
}

function normalizeBody(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function senderProviderId(item: Record<string, unknown>) {
  const sender = item.sender && typeof item.sender === "object" ? (item.sender as Record<string, unknown>) : null;
  const value =
    item.sender_provider_id ??
    item.attendee_provider_id ??
    sender?.attendee_provider_id ??
    sender?.provider_id ??
    "";
  return typeof value === "string" ? value : "";
}

function isSender(item: Record<string, unknown>, lead?: Lead) {
  if (isUnipileSelfMessage(item)) return true;
  const flag = item.is_sender ?? item.isSender;
  if (flag === false || flag === 0 || flag === "0" || flag === "false") return false;
  const provider = senderProviderId(item);
  if (lead?.unipileProviderId && provider) return provider !== lead.unipileProviderId;
  return false;
}

function directionOf(item: Record<string, unknown>, lead?: Lead): OutreachMessage["direction"] {
  return isSender(item, lead) ? "outbound" : "inbound";
}

function sameThreadMessage(local: OutreachMessage, item: Record<string, unknown>) {
  const remoteId = unipileItemId(item);
  if (remoteId && local.unipileMessageId?.trim() === remoteId) return true;
  if (normalizeBody(local.body) !== normalizeBody(unipileMessageText(item))) return false;
  const time = unipileMessageTime(item);
  if (!time) return true;
  return Math.abs(local.sentAt.getTime() - time) < MATCH_WINDOW_MS;
}

function usedRemoteIds(messages: OutreachMessage[], exceptId?: string) {
  return messages
    .filter((item) => item.id !== exceptId)
    .map((item) => item.unipileMessageId?.trim() ?? "")
    .filter(Boolean);
}

function resolveRemoteId(
  items: Array<Record<string, unknown>>,
  message: OutreachMessage,
  chatId: string,
  siblings: OutreachMessage[],
) {
  const used = usedRemoteIds(siblings, message.id);
  let remoteId = message.unipileMessageId?.trim() ?? "";
  if (remoteId && (remoteId === chatId || used.includes(remoteId))) remoteId = "";
  if (!remoteId) {
    remoteId = findUnipileMessageId(items, message.body, message.sentAt, used);
  }
  return remoteId;
}

export async function reconcileLeadChat(lead: Lead) {
  const chatId = lead.unipileChatId?.trim() ?? "";
  if (!chatId) return [] as string[];
  const items = await chatItems(chatId);
  if (items.length === 0) return [] as string[];

  const deletedIds = new Set(
    items.filter(isUnipileMessageDeleted).map(unipileItemId).filter(Boolean),
  );
  const alive = aliveUnipileMessages(items);
  const local = await fetchMessagesForLead(lead.id);
  const matchedLocal = new Set<string>();
  const matchedRemote = new Set<string>();

  for (const message of local) {
    const remoteId = message.unipileMessageId?.trim() ?? "";
    if (!remoteId) continue;
    const hit = alive.find((item) => unipileItemId(item) === remoteId);
    if (!hit) continue;
    matchedLocal.add(message.id);
    matchedRemote.add(remoteId);
  }

  for (const message of local) {
    if (matchedLocal.has(message.id)) continue;
    const candidates = alive.filter((item) => {
      const id = unipileItemId(item);
      if (id && matchedRemote.has(id)) return false;
      return sameThreadMessage(message, item);
    });
    if (candidates.length === 0) continue;
    candidates.sort(
      (a, b) =>
        Math.abs(unipileMessageTime(a) - message.sentAt.getTime()) -
        Math.abs(unipileMessageTime(b) - message.sentAt.getTime()),
    );
    const id = unipileItemId(candidates[0] ?? {});
    matchedLocal.add(message.id);
    if (id) matchedRemote.add(id);
  }

  const gone: string[] = [];
  for (const message of local) {
    if (isReactionNotice(message.body)) {
      await deleteMessageDoc(message.id);
      gone.push(message.id);
      matchedLocal.add(message.id);
      continue;
    }
    const remoteId = message.unipileMessageId?.trim() ?? "";
    const deletedById = Boolean(remoteId && deletedIds.has(remoteId));
    const deletedNearby =
      !matchedLocal.has(message.id) &&
      items.some(
        (item) =>
          isUnipileMessageDeleted(item) &&
          Math.abs(unipileMessageTime(item) - message.sentAt.getTime()) < 5 * 60 * 1000,
      );
    if (!deletedById && !deletedNearby) continue;
    await deleteMessageDoc(message.id);
    gone.push(message.id);
    matchedLocal.add(message.id);
  }

  let remaining = local.filter((item) => !gone.includes(item.id));
  for (const message of remaining) {
    if (message.direction !== "inbound") continue;
    const twin = remaining.find(
      (item) =>
        item.id !== message.id &&
        item.direction === "outbound" &&
        normalizeBody(item.body) === normalizeBody(message.body),
    );
    if (!twin) {
      const remote = alive.find((item) => sameThreadMessage(message, item));
      if (remote && isSender(remote, lead) && message.direction === "inbound") {
        await patchMessage(message.id, { direction: "outbound" });
        message.direction = "outbound";
      }
      continue;
    }
    await deleteMessageDoc(message.id);
    gone.push(message.id);
  }
  remaining = remaining.filter((item) => !gone.includes(item.id));

  const campaign = await fetchCampaign(lead.campaignId);
  for (const item of alive) {
    const id = unipileItemId(item);
    if (id && matchedRemote.has(id)) continue;
    const text = unipileMessageText(item);
    if (!text || isReactionNotice(text)) continue;
    const already = remaining.some((message) => sameThreadMessage(message, item));
    if (already) continue;
    const sentAtMs = unipileMessageTime(item);
    await createMessage({
      brandId: lead.brandId,
      campaignId: lead.campaignId,
      campaignName: campaign?.name ?? remaining[0]?.campaignName ?? "",
      leadId: lead.id,
      leadName: lead.fullName,
      direction: directionOf(item, lead),
      body: text,
      sentAt: sentAtMs ? new Date(sentAtMs) : new Date(),
      unipileMessageId: id,
      reactions: unipileReactionEmojis(item),
    });
    if (id) matchedRemote.add(id);
  }

  remaining = await fetchMessagesForLead(lead.id);
  for (const item of alive) {
    const emojis = unipileReactionEmojis(item);
    if (emojis.length === 0) continue;
    const parent = remaining.find((message) => sameThreadMessage(message, item) || message.unipileMessageId === unipileItemId(item));
    if (!parent) continue;
    const next = [...new Set([...(parent.reactions ?? []), ...emojis])];
    if (next.join() === (parent.reactions ?? []).join()) continue;
    await patchMessage(parent.id, { reactions: next });
    parent.reactions = next;
  }
  for (const item of items.filter(isUnipileReactionItem)) {
    const emojis = unipileReactionEmojis(item);
    if (emojis.length === 0) continue;
    const parentId = unipileReactedMessageId(item);
    const parent =
      remaining.find((message) => parentId && message.unipileMessageId === parentId) ??
      remaining
        .filter((message) => message.direction === "outbound")
        .sort(
          (a, b) =>
            Math.abs(a.sentAt.getTime() - unipileMessageTime(item)) -
            Math.abs(b.sentAt.getTime() - unipileMessageTime(item)),
        )[0];
    if (!parent) continue;
    const next = [...new Set([...(parent.reactions ?? []), ...emojis])];
    if (next.join() === (parent.reactions ?? []).join()) continue;
    await patchMessage(parent.id, { reactions: next });
    parent.reactions = next;
  }

  return gone;
}

export async function deleteOutreachMessage(input: { brandId: string; messageId: string }) {
  const message = await fetchMessage(input.messageId);
  if (!message || message.brandId !== input.brandId) throw new Error("not-found");
  if (message.direction !== "outbound") throw new Error("not-outbound");

  const [brand, lead] = await Promise.all([fetchBrand(input.brandId), fetchLead(message.leadId)]);
  if (!brand) throw new Error("not-found");
  if (brand.testMode) throw new Error("test-mode");
  if (brand.archived || brand.outreachPaused) throw new Error("outreach-paused");
  if (brand.unipileStatus !== "running" || !brand.unipileAccountId) {
    throw new Error("seat-disconnected");
  }

  const chatId = lead?.unipileChatId?.trim() ?? "";
  const items = await chatItems(chatId);
  const siblings = await fetchMessagesForLead(message.leadId);
  const remoteId = resolveRemoteId(items, message, chatId, siblings);
  if (!remoteId) {
    await deleteMessageDoc(message.id);
    return { ok: true as const };
  }
  const onLinkedIn = aliveUnipileMessages(items).some((item) => unipileItemId(item) === remoteId);

  if (!onLinkedIn) {
    await deleteMessageDoc(message.id);
    return { ok: true as const };
  }

  try {
    await deleteUnipileChatMessage(chatId, remoteId);
  } catch (error) {
    if (unipileErrorLooksGone(error)) {
      await deleteMessageDoc(message.id);
      return { ok: true as const };
    }
    const remains = aliveUnipileMessages(await chatItems(chatId)).some(
      (item) => unipileItemId(item) === remoteId,
    );
    if (!remains) {
      await deleteMessageDoc(message.id);
      return { ok: true as const };
    }
    if (
      unipileErrorLooksTooOld(error) ||
      Date.now() - message.sentAt.getTime() > LINKEDIN_UNSEND_MS
    ) {
      throw new Error("linkedin-too-old");
    }
    if (error instanceof UnipileError) throw new Error("linkedin-denied");
    throw error;
  }

  await deleteMessageDoc(message.id);
  return { ok: true as const };
}

export async function applyRemoteMessageDeleted(input: {
  brandId: string;
  messageId?: string;
  chatId?: string;
}) {
  const remoteId = input.messageId?.trim() ?? "";
  if (remoteId) {
    const byId = await findMessageByUnipileId(input.brandId, remoteId);
    if (byId) {
      await deleteMessageDoc(byId.id);
      return { deleted: byId.id };
    }
  }

  const chatId = input.chatId?.trim() ?? "";
  if (!chatId || !remoteId) return { deleted: null as string | null };
  const lead = await findLeadByChatId(input.brandId, chatId);
  if (!lead) return { deleted: null as string | null };
  const local = await fetchMessagesForLead(lead.id);
  const match = local.find((item) => item.unipileMessageId?.trim() === remoteId);
  if (!match) return { deleted: null as string | null };
  await deleteMessageDoc(match.id);
  return { deleted: match.id };
}

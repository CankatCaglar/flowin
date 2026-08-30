import "server-only";
import {
  attachUnipileAccount,
  fetchBrand,
  findBrandByUnipileAccount,
  setUnipileStatus,
} from "@/lib/data";
import {
  fetchCampaign,
  findAwaitingLeads,
  findLeadByProvider,
  findLeadByPublicId,
} from "@/lib/outreach-data";
import { markLeadAccepted, markLeadReplied } from "@/lib/sequence-runner";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.text === "string") return record.text;
  if (typeof record.body === "string") return record.body;
  if (typeof record.message === "string") return record.message;
  return "";
}

export async function attachAccountFromNotify(input: {
  brandId?: string;
  accountId?: string;
  status?: string;
}) {
  const brandId = input.brandId?.trim();
  const accountId = input.accountId?.trim();
  if (!brandId || !accountId) return null;
  const status = String(input.status ?? "").toUpperCase();
  if (status && !["CREATION_SUCCESS", "RECONNECTED", "OK", "RUNNING"].includes(status)) {
    if (["CREDENTIALS", "ERROR", "STOPPED", "DISCONNECTED"].includes(status)) {
      await setUnipileStatus(brandId, status === "CREDENTIALS" ? "disconnected" : "error");
    }
    return fetchBrand(brandId);
  }
  return attachUnipileAccount(brandId, accountId, "running");
}

async function brandFromAccount(accountId: string) {
  return findBrandByUnipileAccount(accountId);
}

function attendeeIds(payload: Record<string, unknown>) {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value) ids.push(value);
  };
  push(payload.attendee_provider_id);
  push(payload.provider_id);
  const attendee = asRecord(payload.attendee);
  if (attendee) {
    push(attendee.provider_id);
    push(attendee.id);
    push(attendee.public_identifier);
  }
  const attendees = payload.attendees;
  if (Array.isArray(attendees)) {
    attendees.forEach((item) => {
      if (typeof item === "string") push(item);
      const row = asRecord(item);
      if (row) {
        push(row.provider_id);
        push(row.id);
        push(row.public_identifier);
      }
    });
  }
  return [...new Set(ids)];
}

async function findLeadFromIds(brandId: string, ids: string[]) {
  for (const id of ids) {
    const byProvider = await findLeadByProvider(brandId, id);
    if (byProvider) return byProvider;
    const byPublic = await findLeadByPublicId(brandId, id);
    if (byPublic) return byPublic;
  }
  return null;
}

export async function handleUnipileWebhook(body: unknown) {
  const data = asRecord(body);
  if (!data) return { ignored: true };

  if (typeof data.account_id === "string" && typeof data.name === "string" && data.status) {
    await attachAccountFromNotify({
      brandId: data.name,
      accountId: data.account_id,
      status: String(data.status),
    });
    return { account: true };
  }

  const type = String(data.type ?? data.event ?? "").toLowerCase();
  const accountId =
    (typeof data.account_id === "string" && data.account_id) ||
    (typeof asRecord(data.account)?.id === "string" && String(asRecord(data.account)?.id));
  const payload = asRecord(data.payload) ?? data;

  if (accountId && (type.includes("account.add") || type.includes("account.reconnect"))) {
    const brand =
      (await findBrandByUnipileAccount(accountId)) ??
      (typeof data.name === "string" ? await fetchBrand(data.name) : null);
    if (brand) await attachUnipileAccount(brand.id, accountId, "running");
    return { account: true };
  }

  if (accountId && (type.includes("disconnected") || type.includes("credentials"))) {
    const brand = await brandFromAccount(accountId);
    if (brand) await setUnipileStatus(brand.id, "disconnected");
    return { account: true };
  }

  if (accountId && (type.includes("errored") || type.includes("error"))) {
    const brand = await brandFromAccount(accountId);
    if (brand) await setUnipileStatus(brand.id, "error");
    return { account: true };
  }

  if (!accountId) return { ignored: true };
  const brand = await brandFromAccount(accountId);
  if (!brand) return { ignored: true };

  const inbound =
    type.includes("message") &&
    (type.includes("received") ||
      payload.is_sender === false ||
      payload.sender === "attendee" ||
      String(payload.direction ?? "") === "inbound");

  if (inbound || type === "new_message" || type === "message_received") {
    const isSender = payload.is_sender === true || payload.sender === "self";
    if (isSender) return { ignored: true };
    const lead = await findLeadFromIds(brand.id, attendeeIds(payload));
    if (!lead) return { ignored: true };
    const campaign = await fetchCampaign(lead.campaignId);
    if (!campaign) return { ignored: true };
    await markLeadReplied(lead, campaign, textOf(payload) || textOf(asRecord(payload.message)));
    return { replied: lead.id };
  }

  const accepted =
    type.includes("invitation") &&
    (type.includes("accept") || type.includes("relation") || type.includes("connected"));
  if (accepted || type.includes("new_relation") || type.includes("relation.created")) {
    const lead = await findLeadFromIds(brand.id, attendeeIds(payload));
    const target = lead ?? (await firstAwaiting(brand.id, "connection"));
    if (!target) return { ignored: true };
    const campaign = await fetchCampaign(target.campaignId);
    if (!campaign) return { ignored: true };
    await markLeadAccepted(target, campaign);
    return { accepted: target.id };
  }

  return { ignored: true };
}

async function firstAwaiting(brandId: string, kind: "connection" | "inmail") {
  const leads = await findAwaitingLeads(brandId, kind);
  return leads[0] ?? null;
}


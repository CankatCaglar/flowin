import "server-only";
import { companyFromHeadline, companyFromProfileRecord } from "@/lib/linkedin-company";
import { linkedInPublicId, normalizeLinkedInUrl } from "@/lib/linkedin-profile";

export function getUnipileConfig() {
  const rawDsn = process.env.UNIPILE_DSN?.trim() ?? "";
  const apiKey = process.env.UNIPILE_API_KEY?.trim() ?? "";
  const dsn = normalizeDsn(rawDsn);
  return {
    dsn,
    apiKey,
    configured: Boolean(dsn && apiKey),
  };
}

export function isUnipileConfigured() {
  return getUnipileConfig().configured;
}

function normalizeDsn(value: string) {
  if (!value) return "";
  const trimmed = value.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function appOrigin(request?: Request) {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (request) return new URL(request.url).origin;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export class UnipileError extends Error {
  status: number;
  retryable: boolean;
  type: string;

  constructor(message: string, status = 500, retryable = false, type = "") {
    super(message);
    this.name = "UnipileError";
    this.status = status;
    this.retryable = retryable || status === 429 || status >= 500;
    this.type = type;
  }
}

type UnipileMethod = "GET" | "POST" | "DELETE";

async function unipileRequest<T>(
  path: string,
  init?: {
    method?: UnipileMethod;
    query?: Record<string, string | undefined>;
    body?: unknown;
    form?: Record<string, string | boolean | undefined>;
  },
): Promise<T> {
  const { dsn, apiKey, configured } = getUnipileConfig();
  if (!configured) throw new UnipileError("unipile-unconfigured", 503);

  const url = new URL(path.startsWith("http") ? path : `${dsn}${path}`);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "X-API-KEY": apiKey,
  };

  let body: BodyInit | undefined;
  if (init?.form) {
    const form = new FormData();
    for (const [key, value] of Object.entries(init.form)) {
      if (value === undefined) continue;
      form.append(key, String(value));
    }
    body = form;
  } else if (init?.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    title?: unknown;
    detail?: unknown;
    type?: unknown;
    message?: unknown;
  };
  if (!response.ok) {
    const detail =
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.title === "string" && data.title) ||
      (typeof data.message === "string" && data.message) ||
      `unipile-${response.status}`;
    throw new UnipileError(
      detail,
      response.status,
      response.status === 429,
      typeof data.type === "string" ? data.type : "",
    );
  }
  return data;
}

export type HostedAuthType = "create" | "reconnect";

export async function createHostedAuthLink(input: {
  type: HostedAuthType;
  brandId: string;
  origin: string;
  locale: string;
  reconnectAccount?: string;
}) {
  const { dsn } = getUnipileConfig();
  const expiresOn = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const payload: Record<string, unknown> = {
    type: input.type,
    providers: ["LINKEDIN"],
    api_url: dsn,
    expiresOn,
    name: input.brandId,
    success_redirect_url: `${input.origin}/api/unipile/callback?ok=1&locale=${input.locale}`,
    failure_redirect_url: `${input.origin}/api/unipile/callback?ok=0&locale=${input.locale}`,
    notify_url: `${input.origin}/api/unipile/notify`,
  };
  if (input.type === "reconnect" && input.reconnectAccount) {
    payload.reconnect_account = input.reconnectAccount;
  }
  const data = await unipileRequest<{ url?: string }>(
    "/api/v1/hosted/accounts/link",
    { method: "POST", body: payload },
  );
  if (typeof data.url !== "string" || !data.url) {
    throw new UnipileError("hosted-auth-link-missing", 502);
  }
  return data.url;
}

export type UnipileAccount = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  sources?: { status?: string }[];
  connection_params?: {
    im?: {
      publicIdentifier?: string;
      public_identifier?: string;
      username?: string;
      organizations?: Array<{ name?: string }>;
    };
  };
};

export function unipileAccountPublicId(account: UnipileAccount) {
  const im = account.connection_params?.im;
  // Try the most specific field first, fall back to username (LinkedIn vanity name)
  return String(im?.publicIdentifier ?? im?.public_identifier ?? im?.username ?? "").trim();
}

export async function listUnipileAccounts() {
  const data = await unipileRequest<{ items?: UnipileAccount[] }>("/api/v1/accounts");
  return data.items ?? [];
}

export async function findAccountForBrand(brandId: string) {
  const accounts = await listUnipileAccounts();
  return (
    accounts.find((account) => account.name === brandId) ??
    accounts.find((account) => account.id === brandId) ??
    null
  );
}

export type UnipileProfile = {
  provider_id?: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  headline?: string;
  description?: string;
  is_relationship?: boolean;
  network_distance?: string;
  notify_visit_token?: string;
  member_urn?: string;
  public_profile_url?: string;
  current_positions?: Array<{ company?: unknown; role?: string }>;
  work_experience?: Array<{ company?: unknown; end?: unknown }>;
  experience?: Array<{ company?: unknown; ended_on?: unknown; end?: unknown }>;
  company?: unknown;
  profile_picture_url?: string;
  profile_picture_url_large?: string;
  public_picture_url?: string;
  public_picture_url_large?: string;
};

function asPictureUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function unipilePictureUrl(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const data = input as Record<string, unknown>;
  const nested = [
    data,
    data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : null,
    data.specifics && typeof data.specifics === "object"
      ? (data.specifics as Record<string, unknown>)
      : null,
  ].filter(Boolean) as Record<string, unknown>[];
  const keys = [
    "profile_picture_url_large",
    "public_picture_url_large",
    "profile_picture_url",
    "public_picture_url",
    "picture_url",
    "profile_picture",
    "picture",
  ];
  for (const source of nested) {
    for (const key of keys) {
      const value = asPictureUrl(source[key]) || nestedPicture(source[key]);
      if (value) return value;
    }
  }
  for (const source of nested) {
    for (const [key, value] of Object.entries(source)) {
      if (/background/i.test(key)) continue;
      const fromNested = nestedPicture(value);
      if (fromNested) return fromNested;
      if (typeof value === "string" && /media\.licdn\.com/i.test(value)) return value.trim();
    }
  }
  return "";
}

function nestedPicture(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return (
    asPictureUrl(record.url) ||
    asPictureUrl(record.profile_picture_url_large) ||
    asPictureUrl(record.public_picture_url_large) ||
    asPictureUrl(record.profile_picture_url) ||
    asPictureUrl(record.public_picture_url)
  );
}

export async function getUnipileProfile(accountId: string, identifier: string) {
  return unipileRequest<UnipileProfile>(`/api/v1/users/${encodeURIComponent(identifier)}`, {
    query: { account_id: accountId, linkedin_sections: "*" },
  });
}

export async function getUnipileProfileExperience(accountId: string, identifier: string) {
  return unipileRequest<UnipileProfile>(`/api/v1/users/${encodeURIComponent(identifier)}`, {
    query: { account_id: accountId, linkedin_sections: "experience" },
  });
}

export function companyFromUnipileProfile(profile: UnipileProfile) {
  return companyFromProfileRecord(profile as unknown as Record<string, unknown>);
}

export function companyFromUnipileAccount(account: UnipileAccount) {
  const orgs = account.connection_params?.im?.organizations ?? [];
  return orgs.map((org) => org.name?.trim()).find(Boolean) ?? "";
}

async function companyFromIdentifier(accountId: string, identifier: string) {
  try {
    const fromLite = companyFromUnipileProfile(await getUnipileProfileLite(accountId, identifier));
    if (fromLite) return fromLite;
  } catch (error) {
    console.error(
      "[unipile] company lite failed:",
      identifier === "me" ? "me" : "id",
      error instanceof Error ? error.message : error,
    );
  }
  try {
    return companyFromUnipileProfile(await getUnipileProfileExperience(accountId, identifier));
  } catch (error) {
    console.error(
      "[unipile] company experience failed:",
      identifier === "me" ? "me" : "id",
      error instanceof Error ? error.message : error,
    );
    return "";
  }
}

export async function fetchAccountCompany(accountId: string, publicId?: string) {
  const identifiers = ["me", publicId?.trim()].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
  );
  for (const identifier of identifiers) {
    const company = await companyFromIdentifier(accountId, identifier);
    if (company) return company;
  }
  try {
    const account = await unipileRequest<UnipileAccount>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}`,
    );
    return companyFromUnipileAccount(account);
  } catch (error) {
    console.error(
      "[unipile] company account failed:",
      error instanceof Error ? error.message : error,
    );
    return "";
  }
}

export async function getUnipileProfileLite(accountId: string, identifier: string) {
  return unipileRequest<UnipileProfile>(`/api/v1/users/${encodeURIComponent(identifier)}`, {
    query: { account_id: accountId },
  });
}

export async function resolveLinkedInProfile(accountId: string, rawUrl: string) {
  const linkedinUrl = normalizeLinkedInUrl(rawUrl);
  const identifier = linkedInPublicId(linkedinUrl) || linkedinUrl;
  if (!linkedinUrl || !identifier) {
    throw new UnipileError("invalid-linkedin-url", 400);
  }
  const profile = await getUnipileProfileLite(accountId, identifier);
  const role = profile.current_positions?.[0];
  const fullName =
    (typeof profile.name === "string" && profile.name.trim()) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const publicId = profile.public_identifier || linkedInPublicId(linkedinUrl);
  return {
    fullName: fullName || publicId.replace(/-/g, " "),
    linkedinUrl:
      (typeof profile.public_profile_url === "string" && profile.public_profile_url) ||
      (publicId ? `https://www.linkedin.com/in/${publicId}` : linkedinUrl),
    company: companyFromUnipileProfile(profile),
    position: role?.role || profile.headline || "",
    unipileProviderId: profile.provider_id || "",
    pictureUrl: unipilePictureUrl(profile),
  };
}

export async function reportProfileVisit(accountId: string, token: string) {
  if (!token) return;
  try {
    await unipileRequest("/api/v1/linkedin/profile/visit", {
      method: "POST",
      body: { account_id: accountId, notify_visit_token: token },
    });
  } catch {
    await unipileRequest("/api/v1/users/profile/visit", {
      method: "POST",
      body: { account_id: accountId, notify_visit_token: token },
    });
  }
}

export async function sendUnipileInvitation(
  accountId: string,
  providerId: string,
  message?: string,
) {
  const note = message?.trim() ?? "";
  return unipileRequest("/api/v1/users/invite", {
    method: "POST",
    body: {
      account_id: accountId,
      provider_id: providerId,
      ...(note ? { message: note } : {}),
    },
  });
}

export async function startUnipileChat(input: {
  accountId: string;
  attendeeId: string;
  text: string;
  inmail?: boolean;
}) {
  return unipileRequest<{ id?: string; chat_id?: string; message_id?: string }>("/api/v1/chats", {
    method: "POST",
    form: {
      account_id: input.accountId,
      text: input.text,
      attendees_ids: input.attendeeId,
      "linkedin[api]": "classic",
      "linkedin[inmail]": input.inmail ? "true" : undefined,
    },
  });
}

export function unipileSentIds(sent: { id?: string; chat_id?: string; message_id?: string }) {
  const chatId = sent.chat_id || "";
  const messageId =
    (sent.message_id && sent.message_id !== chatId ? sent.message_id : "") ||
    (chatId && sent.id && sent.id !== chatId ? sent.id : "");
  return { chatId: chatId || sent.id || "", messageId };
}

export async function listUnipileChatMessages(chatId: string) {
  const items: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const data = await unipileRequest<{
      items?: Array<Record<string, unknown>>;
      cursor?: string;
      next_cursor?: string;
    }>(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`, {
      query: { limit: "100", cursor },
    });
    items.push(...(data.items ?? []));
    cursor = data.next_cursor || data.cursor || "";
    if (!cursor || !(data.items?.length)) break;
  }
  return items;
}

export function isUnipileSelfMessage(item: Record<string, unknown>) {
  const flag = item.is_sender ?? item.isSender;
  if (flag === true || flag === 1 || flag === "1" || flag === "true") return true;
  if (flag === false || flag === 0 || flag === "0" || flag === "false") return false;
  const sender = String(item.sender ?? "").toLowerCase();
  if (sender === "self" || sender === "me" || sender === "user") return true;
  return String(item.direction ?? "").toLowerCase() === "outbound";
}

export function isUnipileReactionItem(item: Record<string, unknown>) {
  const event = `${item.event ?? ""} ${item.type ?? ""}`.toLowerCase();
  if (event.includes("reaction")) return true;
  const text = unipileMessageText(item);
  if (/reacted\s+\S+\s*$/i.test(text) || /tepki verdi/i.test(text)) return true;
  if ((item.reaction || item.reactions) && !text) return true;
  return false;
}

export function unipileReactionEmojis(item: Record<string, unknown>) {
  const emojis: string[] = [];
  if (typeof item.reaction === "string" && item.reaction.trim()) emojis.push(item.reaction.trim());
  if (Array.isArray(item.reactions)) {
    for (const row of item.reactions) {
      if (typeof row === "string" && row.trim()) emojis.push(row.trim());
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        const value = rec.emoji ?? rec.value ?? rec.reaction;
        if (typeof value === "string" && value.trim()) emojis.push(value.trim());
      }
    }
  }
  const notice = unipileMessageText(item).match(/reacted\s+(\S+)\s*$/i)?.[1];
  if (notice) emojis.push(notice);
  return [...new Set(emojis)];
}

export function unipileReactedMessageId(item: Record<string, unknown>) {
  const id = item.message_id ?? item.original_id ?? item.quoted_id;
  return typeof id === "string" ? id : "";
}

export function unipileItemId(item: Record<string, unknown>) {
  const id = item.id ?? item.message_id;
  return typeof id === "string" ? id : "";
}

export function unipileMessageText(item: Record<string, unknown>) {
  const nested = item.message && typeof item.message === "object" ? (item.message as Record<string, unknown>) : null;
  const raw =
    (typeof item.text === "string" && item.text) ||
    (typeof item.body === "string" && item.body) ||
    (typeof nested?.text === "string" && nested.text) ||
    "";
  return raw.replace(/\s+/g, " ").trim();
}

export function unipileMessageTime(item: Record<string, unknown>) {
  const raw = item.timestamp ?? item.date ?? item.created_at ?? item.sent_at;
  const date = raw instanceof Date ? raw : raw ? new Date(String(raw)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export function isUnipileMessageDeleted(item: Record<string, unknown>) {
  if (item.deleted === true || item.is_deleted === true) return true;
  const status = String(item.status ?? item.event ?? "").toLowerCase();
  if (status.includes("delete")) return true;
  return /^(bu mesaj silindi\.?|this message was deleted\.?|message deleted\.?)$/i.test(
    unipileMessageText(item),
  );
}

export function aliveUnipileMessages(items: Array<Record<string, unknown>>) {
  return items.filter(
    (item) =>
      !isUnipileMessageDeleted(item) &&
      !isUnipileReactionItem(item) &&
      unipileItemId(item),
  );
}

export function unipileErrorLooksGone(error: unknown) {
  if (!(error instanceof UnipileError)) return false;
  if (error.status === 404 || error.status === 410) return true;
  const blob = `${error.type} ${error.message}`.toLowerCase();
  return /not found|already deleted|does not exist|no longer|resource_not_found|invalid_resource/.test(
    blob,
  );
}

export function unipileErrorLooksTooOld(error: unknown) {
  if (!(error instanceof UnipileError)) return false;
  const blob = `${error.type} ${error.message}`.toLowerCase();
  return /60|too late|too old|cannot be deleted|can't be deleted|not allowed to delete|unsend/.test(blob);
}

export async function deleteUnipileChatMessage(chatId: string, messageId: string) {
  try {
    await unipileRequest(`/api/v1/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
  } catch (error) {
    if (unipileErrorLooksGone(error)) return;
    if (!(error instanceof UnipileError) || (error.status !== 400 && error.status !== 404)) {
      throw error;
    }
    try {
      await unipileRequest(
        `/api/v1/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      );
    } catch (fallback) {
      if (unipileErrorLooksGone(fallback)) return;
      throw fallback;
    }
  }
}

function asMessageText(item: Record<string, unknown>) {
  return unipileMessageText(item);
}

function asMessageTime(item: Record<string, unknown>) {
  return unipileMessageTime(item);
}

export function findUnipileMessageId(
  items: Array<Record<string, unknown>>,
  body: string,
  sentAt?: Date,
  excludeIds?: Iterable<string>,
) {
  const target = body.replace(/\s+/g, " ").trim();
  if (!target) return "";
  const skip = new Set([...(excludeIds ?? [])].filter(Boolean));
  const ours = aliveUnipileMessages(items).filter((item) => {
    const id = unipileItemId(item);
    if (id && skip.has(id)) return false;
    if (!isUnipileSelfMessage(item)) return false;
    return asMessageText(item).toLocaleLowerCase() === target.toLocaleLowerCase();
  });
  if (ours.length === 0) return "";
  const wanted = sentAt?.getTime() ?? 0;
  ours.sort(
    (a, b) => Math.abs(asMessageTime(a) - wanted) - Math.abs(asMessageTime(b) - wanted),
  );
  return unipileItemId(ours[0] ?? {});
}

export function chatHasUnipileMessage(
  items: Array<Record<string, unknown>>,
  input: { remoteId?: string; body: string; sentAt?: Date },
) {
  const alive = aliveUnipileMessages(items);
  const remoteId = input.remoteId?.trim() ?? "";
  if (remoteId && alive.some((item) => unipileItemId(item) === remoteId)) return true;
  return Boolean(findUnipileMessageId(alive, input.body, input.sentAt));
}

export async function sendUnipileChatMessage(input: {
  accountId: string;
  chatId?: string;
  attendeeId: string;
  text: string;
}) {
  if (input.chatId) {
    try {
      const sent = await unipileRequest<{ id?: string; chat_id?: string; message_id?: string }>(
        `/api/v1/chats/${encodeURIComponent(input.chatId)}/messages`,
        {
          method: "POST",
          form: { text: input.text },
        },
      );
      return { ...sent, chat_id: sent.chat_id || input.chatId };
    } catch (error) {
      if (!(error instanceof UnipileError) || (error.status !== 400 && error.status !== 404)) {
        throw error;
      }
    }
  }
  return startUnipileChat({
    accountId: input.accountId,
    attendeeId: input.attendeeId,
    text: input.text,
  });
}

export type SalesNavPerson = {
  fullName: string;
  linkedinUrl: string;
  company: string;
  position: string;
  publicId: string;
  providerId: string;
  pictureUrl: string;
};

function asPerson(item: Record<string, unknown>): SalesNavPerson | null {
  const publicId =
    (typeof item.public_identifier === "string" && item.public_identifier) ||
    (typeof item.publicIdentifier === "string" && item.publicIdentifier) ||
    "";
  const providerId =
    (typeof item.provider_id === "string" && item.provider_id) ||
    (typeof item.id === "string" && item.id) ||
    "";
  const first = typeof item.first_name === "string" ? item.first_name : "";
  const last = typeof item.last_name === "string" ? item.last_name : "";
  const name =
    (typeof item.name === "string" && item.name) ||
    [first, last].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const positions = Array.isArray(item.current_positions)
    ? (item.current_positions as Record<string, unknown>[])
    : [];
  const role = positions[0] ?? {};
  const position =
    (typeof role.role === "string" && role.role) ||
    (typeof item.headline === "string" && item.headline) ||
    "";
  const company =
    companyFromProfileRecord(item) ||
    companyFromHeadline(position);
  const url =
    (typeof item.public_profile_url === "string" && item.public_profile_url) ||
    (publicId ? `https://www.linkedin.com/in/${publicId}` : "");
  return {
    fullName: name,
    linkedinUrl: url,
    company,
    position,
    publicId,
    providerId,
    pictureUrl: unipilePictureUrl(item),
  };
}

export async function importSalesNavigatorLeads(accountId: string, searchUrl: string) {
  const leads: SalesNavPerson[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 4 && leads.length < 100; page += 1) {
    const data = await unipileRequest<{
      items?: Record<string, unknown>[];
      cursor?: string;
    }>("/api/v1/linkedin/search", {
      method: "POST",
      body: {
        account_id: accountId,
        api: "sales_navigator",
        category: "people",
        url: searchUrl,
        cursor,
      },
    });
    for (const item of data.items ?? []) {
      const person = asPerson(item);
      if (person) leads.push(person);
      if (leads.length >= 100) break;
    }
    if (!data.cursor || data.cursor === cursor) break;
    cursor = data.cursor;
  }
  return leads;
}

export function isFirstDegree(profile: UnipileProfile) {
  if (profile.is_relationship) return true;
  const distance = String(profile.network_distance ?? "").toUpperCase();
  return distance === "DISTANCE_1" || distance === "FIRST_DEGREE" || distance === "1";
}

function inviteErrorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
}

/** LinkedIn already treats this person as a 1st-degree connection. */
export function isAlreadyConnectedInviteError(error: unknown) {
  const text = inviteErrorText(error);
  return (
    text.includes("already connected") ||
    text.includes("already in your network") ||
    text.includes("already a connection") ||
    (text.includes("cannot invite") && text.includes("connected"))
  );
}

/** An invite is already pending — do not send another, just wait. */
export function isPendingInviteError(error: unknown) {
  const text = inviteErrorText(error);
  return (
    text.includes("already been sent") ||
    text.includes("invitation pending") ||
    text.includes("pending invitation") ||
    text.includes("already invited")
  );
}

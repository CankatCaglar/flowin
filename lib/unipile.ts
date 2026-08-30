import "server-only";
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

  constructor(message: string, status = 500, retryable = false) {
    super(message);
    this.name = "UnipileError";
    this.status = status;
    this.retryable = retryable || status === 429 || status >= 500;
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
    throw new UnipileError(detail, response.status, response.status === 429);
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
  connection_params?: { im?: { publicIdentifier?: string; username?: string } };
};

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
  is_relationship?: boolean;
  network_distance?: string;
  notify_visit_token?: string;
  member_urn?: string;
  public_profile_url?: string;
  current_positions?: Array<{ company?: string; role?: string }>;
  company?: string;
};

export async function getUnipileProfile(accountId: string, identifier: string) {
  return unipileRequest<UnipileProfile>(`/api/v1/users/${encodeURIComponent(identifier)}`, {
    query: { account_id: accountId, linkedin_sections: "*" },
  });
}

export async function resolveLinkedInProfile(accountId: string, rawUrl: string) {
  const linkedinUrl = normalizeLinkedInUrl(rawUrl);
  const identifier = linkedInPublicId(linkedinUrl) || linkedinUrl;
  if (!linkedinUrl || !identifier) {
    throw new UnipileError("invalid-linkedin-url", 400);
  }
  const profile = await getUnipileProfile(accountId, identifier);
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
    company: role?.company || profile.company || "",
    position: role?.role || profile.headline || "",
    unipileProviderId: profile.provider_id || "",
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
  message: string,
) {
  return unipileRequest("/api/v1/users/invite", {
    method: "POST",
    body: {
      account_id: accountId,
      provider_id: providerId,
      message,
    },
  });
}

export async function startUnipileChat(input: {
  accountId: string;
  attendeeId: string;
  text: string;
  inmail?: boolean;
}) {
  return unipileRequest<{ id?: string; chat_id?: string }>("/api/v1/chats", {
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

export type SalesNavPerson = {
  fullName: string;
  linkedinUrl: string;
  company: string;
  position: string;
  publicId: string;
  providerId: string;
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
  const company =
    (typeof role.company === "string" && role.company) ||
    (typeof item.company === "string" && item.company) ||
    "";
  const position =
    (typeof role.role === "string" && role.role) ||
    (typeof item.headline === "string" && item.headline) ||
    "";
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

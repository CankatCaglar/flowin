import { randomBytes } from "crypto";

export type LinkedInProfile = {
  sub: string;
  name: string;
  email: string;
  picture: string;
};

const AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO = "https://api.linkedin.com/v2/userinfo";

export function getLinkedInConfig(origin?: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim() ?? "";
  const fromEnv = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const redirectUri =
    fromEnv ||
    (origin ? `${origin}/api/linkedin/callback` : "http://localhost:3000/api/linkedin/callback");
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

export function asAppLocale(value: string | null | undefined) {
  return value === "en" ? "en" : "tr";
}

export function randomOAuthValue(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function linkedInAuthorizeUrl(input: { state: string; redirectUri: string }) {
  const { clientId } = getLinkedInConfig();
  const url = new URL(AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", "openid profile email");
  return url.toString();
}

export async function exchangeLinkedInCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getLinkedInConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
  };
  if (!response.ok || typeof data.access_token !== "string" || !data.access_token) {
    const reason =
      typeof data.error_description === "string"
        ? data.error_description
        : typeof data.error === "string"
          ? data.error
          : `token-${response.status}`;
    console.error("[linkedin] token exchange failed:", reason);
    throw new Error("token-exchange-failed");
  }
  return data.access_token;
}

export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const response = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("[linkedin] userinfo failed:", response.status);
    throw new Error("userinfo-failed");
  }
  const data = (await response.json()) as {
    sub?: unknown;
    name?: unknown;
    given_name?: unknown;
    family_name?: unknown;
    email?: unknown;
    picture?: unknown;
    picture_url?: unknown;
  };
  const sub = typeof data.sub === "string" ? data.sub.trim() : "";
  if (!sub) throw new Error("userinfo-incomplete");
  const given = typeof data.given_name === "string" ? data.given_name.trim() : "";
  const family = typeof data.family_name === "string" ? data.family_name.trim() : "";
  const name =
    (typeof data.name === "string" && data.name.trim()) ||
    [given, family].filter(Boolean).join(" ") ||
    "LinkedIn";
  const picture = asPicture(data.picture) || asPicture(data.picture_url);
  console.info("[linkedin] userinfo", {
    hasName: Boolean(name),
    hasEmail: typeof data.email === "string" && Boolean(data.email),
    hasPicture: Boolean(picture),
  });
  return {
    sub,
    name,
    email: typeof data.email === "string" ? data.email.trim() : "",
    picture,
  };
}

function asPicture(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.url === "string") return record.url.trim();
  if (typeof record.picture === "string") return record.picture.trim();
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.url === "string") return nested.url.trim();
  }
  return "";
}

export function parsePendingProfile(raw: string | undefined): LinkedInProfile | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<LinkedInProfile>;
    if (typeof data.sub !== "string" || !data.sub) return null;
    return {
      sub: data.sub,
      name: typeof data.name === "string" && data.name ? data.name : "LinkedIn",
      email: typeof data.email === "string" ? data.email : "",
      picture: typeof data.picture === "string" ? data.picture : "",
    };
  } catch {
    return null;
  }
}

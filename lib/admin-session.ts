import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "flowin_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function sessionSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD ||
    "flowin-dev-session"
  );
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setAdminSessionCookie(response: NextResponse, email: string) {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ e: email, exp }), "utf8").toString(
    "base64url",
  );
  response.cookies.set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, cookieOptions(MAX_AGE_SEC));
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
}

export function readAdminEmailFromCookie(value: string | undefined) {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      e?: unknown;
      exp?: unknown;
    };
    if (typeof data.e !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return data.e;
  } catch {
    return null;
  }
}

export async function getAdminSessionEmail() {
  const jar = await cookies();
  return readAdminEmailFromCookie(jar.get(ADMIN_COOKIE)?.value);
}

export async function requireAdminEmail() {
  return getAdminSessionEmail();
}

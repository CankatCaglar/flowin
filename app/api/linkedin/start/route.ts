import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import {
  asAppLocale,
  getLinkedInConfig,
  linkedInAuthorizeUrl,
  randomOAuthValue,
} from "@/lib/linkedin";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 10,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = asAppLocale(url.searchParams.get("locale"));
  const origin = url.origin;

  const admin = await getAdminSessionEmail();
  if (!admin) {
    return NextResponse.redirect(new URL(`/${locale}/login?linkedin=1`, origin));
  }

  if (!getLinkedInConfig().configured) {
    return NextResponse.redirect(new URL(`/${locale}/brands?linkedin=config`, origin));
  }

  const redirectUri = `${origin}/api/linkedin/callback`;
  const state = randomOAuthValue();
  const authorize = linkedInAuthorizeUrl({ state, redirectUri });

  const response = NextResponse.redirect(authorize);
  response.cookies.set("flowin_li_state", state, COOKIE);
  response.cookies.set("flowin_li_locale", locale, COOKIE);
  response.cookies.set("flowin_li_redirect", redirectUri, COOKIE);
  return response;
}

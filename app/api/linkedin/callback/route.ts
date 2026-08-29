import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionEmail } from "@/lib/admin-session";
import {
  asAppLocale,
  exchangeLinkedInCode,
  fetchLinkedInProfile,
} from "@/lib/linkedin";

function clearOAuthCookies(response: NextResponse) {
  const expired = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("flowin_li_state", "", expired);
  response.cookies.set("flowin_li_locale", "", expired);
  response.cookies.set("flowin_li_redirect", "", expired);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const locale = asAppLocale(jar.get("flowin_li_locale")?.value);
  const origin = url.origin;
  const brands = (query?: string) =>
    new URL(`/${locale}/brands${query ? `?${query}` : ""}`, origin);

  const fail = (query: string) => {
    const response = NextResponse.redirect(brands(query));
    clearOAuthCookies(response);
    return response;
  };

  const admin = await getAdminSessionEmail();
  if (!admin) {
    return fail("linkedin=error");
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    if (oauthError === "access_denied" || oauthError === "user_cancelled_login") {
      return fail("linkedin=denied");
    }
    if (oauthError === "invalid_scope_error" || oauthError === "unauthorized_scope_error") {
      return fail("linkedin=scope");
    }
    return fail("linkedin=error");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = jar.get("flowin_li_state")?.value;
  const redirectUri =
    jar.get("flowin_li_redirect")?.value || `${origin}/api/linkedin/callback`;
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("linkedin=error");
  }

  try {
    const accessToken = await exchangeLinkedInCode(code, redirectUri);
    const profile = await fetchLinkedInProfile(accessToken);
    const response = NextResponse.redirect(brands());
    clearOAuthCookies(response);
    response.cookies.set("flowin_li_pending", JSON.stringify(profile), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 2,
    });
    return response;
  } catch (error) {
    console.error(
      "[linkedin] callback failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return fail("linkedin=error");
  }
}

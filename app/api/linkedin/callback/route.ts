import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { createBrand } from "@/lib/data";
import {
  asAppLocale,
  exchangeLinkedInCode,
  fetchLinkedInProfile,
} from "@/lib/linkedin";
import { colorFromKey } from "@/lib/utils";

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
  response.cookies.set("flowin_li_pending", "", expired);
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
    const brand = await createBrand({
      name: profile.name,
      avatarColor: colorFromKey(profile.sub),
      linkedinSub: profile.sub,
      linkedinEmail: profile.email,
      avatarUrl: profile.picture,
    });
    const response = NextResponse.redirect(
      brands(brand.avatarUrl ? "linkedin=photo" : "linkedin=nophoto"),
    );
    clearOAuthCookies(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[linkedin] callback failed:", message);
    if (message === "firebase-unconfigured") {
      return fail("linkedin=firebase");
    }
    return fail("linkedin=error");
  }
}

import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { fetchBrand } from "@/lib/data";
import { asAppLocale } from "@/lib/linkedin";
import { appOrigin, createHostedAuthLink, isUnipileConfigured } from "@/lib/unipile";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 20,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = asAppLocale(url.searchParams.get("locale"));
  const origin = appOrigin(request);
  const brandId = url.searchParams.get("brand")?.trim() ?? "";

  const admin = await getAdminSessionEmail();
  if (!admin) {
    return NextResponse.redirect(new URL(`/${locale}/login`, origin));
  }
  if (!isUnipileConfigured()) {
    return NextResponse.redirect(new URL(`/${locale}/brands?unipile=config`, origin));
  }
  if (!brandId) {
    return NextResponse.redirect(new URL(`/${locale}/brands?unipile=error`, origin));
  }

  const brand = await fetchBrand(brandId);
  if (!brand) {
    return NextResponse.redirect(new URL(`/${locale}/brands?unipile=error`, origin));
  }

  try {
    const reconnect = Boolean(brand.unipileAccountId) && brand.unipileStatus !== "running";
    const hosted = await createHostedAuthLink({
      type: reconnect ? "reconnect" : "create",
      brandId: brand.id,
      origin,
      locale,
      reconnectAccount: reconnect ? brand.unipileAccountId : undefined,
    });
    const response = NextResponse.redirect(hosted);
    response.cookies.set("flowin_up_brand", brand.id, COOKIE);
    response.cookies.set("flowin_up_locale", locale, COOKIE);
    return response;
  } catch (error) {
    console.error("[unipile] hosted auth start failed:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL(`/${locale}/brands?unipile=error`, origin));
  }
}

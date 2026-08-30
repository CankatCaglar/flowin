import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { fetchBrand } from "@/lib/data";
import { asAppLocale } from "@/lib/linkedin";
import { appOrigin, isUnipileConfigured } from "@/lib/unipile";
import { syncUnipileSeats } from "@/lib/unipile-sync";

function clearCookies(response: NextResponse) {
  const expired = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("flowin_up_brand", "", expired);
  response.cookies.set("flowin_up_locale", "", expired);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const locale = asAppLocale(jar.get("flowin_up_locale")?.value ?? url.searchParams.get("locale"));
  const origin = appOrigin(request);
  const brands = (query?: string) =>
    new URL(`/${locale}/brands${query ? `?${query}` : ""}`, origin);

  const fail = (query: string) => {
    const response = NextResponse.redirect(brands(query));
    clearCookies(response);
    return response;
  };

  const admin = await getAdminSessionEmail();
  if (!admin) return fail("unipile=error");
  if (url.searchParams.get("ok") === "0") return fail("unipile=denied");

  const brandId = jar.get("flowin_up_brand")?.value ?? "";
  if (!brandId || !isUnipileConfigured()) return fail("unipile=error");

  try {
    await syncUnipileSeats();
    const brand = await fetchBrand(brandId);
    const response = NextResponse.redirect(
      brands(brand?.unipileAccountId ? "unipile=connected" : "unipile=pending"),
    );
    clearCookies(response);
    return response;
  } catch (error) {
    console.error("[unipile] callback failed:", error instanceof Error ? error.message : error);
    return fail("unipile=error");
  }
}

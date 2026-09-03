import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, readAdminEmailFromCookie } from "@/lib/admin-session";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

function localeAndPath(pathname: string) {
  const match = pathname.match(/^\/(tr|en)(?=\/|$)/);
  const locale = match?.[1] ?? routing.defaultLocale;
  const path = (match ? pathname.slice(match[0].length) : pathname) || "/";
  return { locale, path: path.startsWith("/") ? path : `/${path}` };
}

export default function proxy(request: NextRequest) {
  const { locale, path } = localeAndPath(request.nextUrl.pathname);
  const email = readAdminEmailFromCookie(request.cookies.get(ADMIN_COOKIE)?.value);
  const reauthLinkedIn =
    path === "/login" && request.nextUrl.searchParams.get("linkedin") === "1";

  if (!email && path !== "/login" && path !== "/") {
    const login = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(login);
  }

  if (email && (path === "/" || (path === "/login" && !reauthLinkedIn))) {
    return NextResponse.redirect(new URL(`/${locale}/brands`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};

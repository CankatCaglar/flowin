"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

export function HtmlLang({ locale }: { locale: string }) {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = locale;
    const dark = pathname === "/login" || pathname === "/brands";
    document.body.style.background = dark ? "#200624" : "#f7f4f8";
  }, [locale, pathname]);

  return null;
}

"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const switchLocale = (nextLocale: "tr" | "en") => {
    if (nextLocale === locale || pending) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: nextLocale });
    });
  };

  return (
    <div
      className={cn(
        "inline-flex w-fit rounded-full p-1 text-xs font-semibold",
        variant === "dark" ? "bg-white/5" : "bg-canvas",
        pending && "pointer-events-none opacity-70",
      )}
    >
      {(["tr", "en"] as const).map((nextLocale) => (
        <button
          key={nextLocale}
          type="button"
          onClick={() => switchLocale(nextLocale)}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase",
            locale === nextLocale
              ? "bg-barney text-white"
              : variant === "dark"
                ? "text-white/60"
                : "text-muted",
          )}
        >
          {nextLocale}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function UserMenu({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const t = useTranslations("auth");
  const role = useTranslations("header");
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { open, toggle, close } = useMenu("user-menu");
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissable(rootRef, open, close);

  if (!user) return null;

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex items-center gap-3 rounded-xl px-2 py-1.5 text-left",
          variant === "dark" ? "hover:bg-white/5" : "hover:bg-canvas",
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-barney text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden sm:block">
          <span
            className={cn(
              "block text-sm font-semibold",
              variant === "dark" ? "text-white" : "text-ink",
            )}
          >
            {user.displayName}
          </span>
          <span
            className={cn(
              "block text-xs",
              variant === "dark" ? "text-white/55" : "text-muted",
            )}
          >
            {role("management")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4",
            variant === "dark" ? "text-white/50" : "text-muted",
          )}
        />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-20 mt-2 w-44 rounded-xl border p-1 shadow-lg",
            variant === "dark"
              ? "border-purple-jam/40 bg-midnight"
              : "border-purple-jam/10 bg-white",
          )}
        >
          <button
            type="button"
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left text-sm",
              variant === "dark"
                ? "text-white/80 hover:bg-white/5"
                : "text-ink hover:bg-canvas",
            )}
            onClick={async () => {
              close();
              await signOut();
              router.replace("/login");
            }}
          >
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

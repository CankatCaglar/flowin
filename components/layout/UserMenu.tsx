"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { AnchoredMenu, selectOptionClass } from "@/components/ui/SelectMenu";
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
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);

  if (!user) return null;

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={user.displayName}
        className={cn(
          "flex items-center rounded-xl px-1 py-1 text-left sm:gap-3 sm:px-2 sm:py-1.5",
          variant === "dark" ? "hover:bg-white/5" : "hover:bg-canvas",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-barney text-sm font-semibold text-white sm:h-9 sm:w-9">
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
            "hidden h-4 w-4 sm:block",
            variant === "dark" ? "text-white/50" : "text-muted",
          )}
        />
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={rootRef}
        align="right"
        compact
        panelRef={panelRef}
        className={cn("w-44", variant === "dark" && "border-purple-jam/40 bg-midnight")}
      >
        <button
          type="button"
          className={cn(
            selectOptionClass(false),
            variant === "dark" && "text-white/80 hover:bg-barney hover:text-white",
          )}
          onClick={async () => {
            close();
            await signOut();
            router.replace("/login");
          }}
        >
          {t("signOut")}
        </button>
      </AnchoredMenu>
    </div>
  );
}

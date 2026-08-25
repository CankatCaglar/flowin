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

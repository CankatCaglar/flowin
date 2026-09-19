"use client";

import { useRef } from "react";
import { Link2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AnchoredMenu, selectOptionClass } from "@/components/ui/SelectMenu";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { cn } from "@/lib/utils";
import type { Brand } from "@/types";

function hardNavigate(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}

export function BrandCardMenu({
  brand,
  onEdit,
  onDelete,
}: {
  brand: Brand;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("brands");
  const common = useTranslations("common");
  const locale = useLocale();
  const { open, toggle, close } = useMenu(`brand-card-${brand.id}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);
  const outreachOn = brand.unipileStatus === "running";
  const outreachLabel =
    outreachOn || brand.unipileStatus === "disconnected"
      ? t("outreachReconnect")
      : t("outreachConnect");

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={t("cardActions")}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnchoredMenu open={open} anchorRef={rootRef} align="right" panelRef={panelRef} className="w-52">
        <button
          type="button"
          className={selectOptionClass(false)}
          onClick={() => {
            close();
            hardNavigate(
              `/api/unipile/start?locale=${locale}&brand=${encodeURIComponent(brand.id)}`,
            );
          }}
        >
          <Link2 className="h-4 w-4 shrink-0" />
          {outreachLabel}
        </button>
        <button
          type="button"
          className={selectOptionClass(false)}
          onClick={() => {
            close();
            onEdit();
          }}
        >
          <Pencil className="h-4 w-4 shrink-0" />
          {common("edit")}
        </button>
        <button
          type="button"
          className={cn(selectOptionClass(false), "hover:bg-rose-600")}
          onClick={() => {
            close();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {t("delete")}
        </button>
      </AnchoredMenu>
    </div>
  );
}

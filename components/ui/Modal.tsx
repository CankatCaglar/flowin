"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  title,
  children,
  onClose,
  className,
  variant = "dark",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  variant?: "dark" | "light";
}) {
  const t = useTranslations("common");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 bg-midnight/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl p-6",
          variant === "dark" ? "admin-card text-white" : "surface-card text-ink",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label={t("close")}
            className={cn(
              "rounded-lg p-1",
              variant === "dark"
                ? "text-white/60 hover:bg-white/10 hover:text-white"
                : "text-muted hover:bg-canvas hover:text-ink",
            )}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

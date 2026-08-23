"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface FlowinLogoProps {
  className?: string;
  height?: number;
}

export function FlowinLogo({ className, height = 36 }: FlowinLogoProps) {
  const t = useTranslations("meta");
  return (
    <img
      src="/brand/flowin-logo.svg"
      alt={t("title")}
      height={height}
      className={cn("w-auto", className)}
      style={{ height }}
    />
  );
}

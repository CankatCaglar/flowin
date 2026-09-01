"use client";

import { useEffect, useState } from "react";
import { brandInitial, cn } from "@/lib/utils";
import type { Brand } from "@/types";

function storedBrandAvatarUrl(url: string) {
  const path = url.split("?")[0] ?? "";
  return path.startsWith("/api/brands/") && path.endsWith("/avatar");
}

export function BrandAvatar({
  brand,
  size = "md",
  className,
  fetchPriority,
}: {
  brand: Pick<Brand, "id" | "name" | "avatarColor" | "avatarUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const primary = brand.avatarUrl?.trim() ?? "";
  const proxy = `/api/brands/${encodeURIComponent(brand.id)}/avatar`;
  const [src, setSrc] = useState(primary);
  const dim =
    size === "sm"
      ? "h-9 w-9 text-sm"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : "h-14 w-14 text-xl";
  const rounded = size === "sm" ? "rounded-lg" : "rounded-2xl";

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  if (src) {
    return (
      // LinkedIn photo via stored URL, CDN, or /api/brands/:id/avatar.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        decoding="async"
        fetchPriority={fetchPriority}
        referrerPolicy="no-referrer"
        onError={() => {
          if (src !== proxy && !storedBrandAvatarUrl(src)) {
            setSrc(proxy);
            return;
          }
          setSrc("");
        }}
        className={cn("object-cover ring-1 ring-white/15", dim, rounded, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center font-bold text-white",
        dim,
        rounded,
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${brand.avatarColor}, #AE1BB6)`,
      }}
    >
      {brandInitial(brand.name)}
    </span>
  );
}

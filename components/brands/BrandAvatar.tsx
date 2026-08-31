"use client";

import { useState } from "react";
import { brandInitial, cn } from "@/lib/utils";
import type { Brand } from "@/types";

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
  const [useProxy, setUseProxy] = useState(!primary);
  const [failed, setFailed] = useState(false);
  const dim =
    size === "sm"
      ? "h-9 w-9 text-sm"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : "h-14 w-14 text-xl";
  const rounded = size === "sm" ? "rounded-lg" : "rounded-2xl";
  const photo = failed ? "" : useProxy ? proxy : primary;

  if (photo) {
    return (
      // Served from /api/brands/:id/avatar or the LinkedIn CDN.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        decoding="async"
        fetchPriority={fetchPriority}
        referrerPolicy="no-referrer"
        onError={() => {
          const primaryPath = primary.split("?")[0] ?? primary;
          if (!useProxy && proxy !== primaryPath) {
            setUseProxy(true);
            return;
          }
          setFailed(true);
        }}
        className={cn(
          "object-cover ring-1 ring-white/15",
          dim,
          rounded,
          className,
        )}
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

"use client";

import { useState } from "react";
import { cn, personInitials } from "@/lib/utils";
import type { Lead } from "@/types";

const AVATAR = [
  "bg-barney text-white",
  "bg-violet-100 text-barney",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
];

export function leadAvatarClass(id: string) {
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR[index % AVATAR.length];
}

export function LeadAvatar({
  lead,
  size = "sm",
  className,
}: {
  lead: Pick<Lead, "id" | "fullName" | "avatarUrl">;
  size?: "sm" | "md";
  className?: string;
}) {
  const primary = lead.avatarUrl?.trim() ?? "";
  const proxy = `/api/leads/${encodeURIComponent(lead.id)}/avatar`;
  const [useProxy, setUseProxy] = useState(!primary);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dim = size === "md" ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";
  const photo = failed ? "" : useProxy ? proxy : primary;

  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", dim, className)}>
      <span
        className={cn(
          "flex h-full w-full items-center justify-center font-semibold",
          size === "md" && "font-display",
          leadAvatarClass(lead.id),
        )}
      >
        {personInitials(lead.fullName)}
      </span>
      {photo ? (
        // LinkedIn photo via stored URL, CDN, or /api/leads/:id/avatar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            const primaryPath = primary.split("?")[0] ?? primary;
            if (!useProxy && proxy !== primaryPath) {
              setUseProxy(true);
              return;
            }
            setFailed(true);
          }}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}

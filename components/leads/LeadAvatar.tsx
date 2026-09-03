"use client";

import { useEffect, useRef, useState } from "react";
import { cn, personInitials } from "@/lib/utils";
import type { Lead } from "@/types";

const AVATAR = [
  "bg-barney text-white",
  "bg-violet-100 text-barney",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
];
const MAX_RETRIES = 2;

export function leadAvatarClass(id: string) {
  const index = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR[index % AVATAR.length];
}

function displayableAvatarUrl(url: string) {
  const path = url.split("?")[0] ?? "";
  return path.startsWith("/api/leads/") && path.endsWith("/avatar") ? url : "";
}

function avatarSrc(url: string, retries: number) {
  if (!url) return "";
  if (!retries) return url;
  const glue = url.includes("?") ? "&" : "?";
  return `${url}${glue}r=${retries}`;
}

export function LeadAvatar({
  lead,
  size = "sm",
  className,
}: {
  lead: Pick<Lead, "id" | "fullName" | "avatarUrl" | "avatarChecked">;
  size?: "sm" | "md";
  className?: string;
}) {
  const src = displayableAvatarUrl(lead.avatarUrl?.trim() ?? "");
  const waiting = !src && !lead.avatarChecked;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retries, setRetries] = useState(0);
  const retrying = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dim = size === "md" ? "h-14 w-14 text-lg" : "h-8 w-8 text-[11px]";
  const photo = failed ? "" : avatarSrc(src, retries);

  useEffect(() => {
    setFailed(false);
    setRetries(0);
    retrying.current = false;
    // A cached image can finish loading before onLoad is observed, so read the
    // element state instead of waiting for the event.
    const node = imgRef.current;
    setLoaded(Boolean(node?.complete && node.naturalWidth > 0));
  }, [src]);

  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", dim, className)}>
      {waiting ? (
        <span className="h-full w-full animate-pulse bg-[#efe8f2]" />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold",
            size === "md" && "font-display",
            leadAvatarClass(lead.id),
          )}
        >
          {personInitials(lead.fullName)}
        </span>
      )}
      {photo ? (
        // LinkedIn photo via stored URL after batch hydrate.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={photo}
          ref={imgRef}
          src={photo}
          alt=""
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (retrying.current) return;
            if (retries >= MAX_RETRIES) {
              setFailed(true);
              return;
            }
            retrying.current = true;
            window.setTimeout(() => {
              retrying.current = false;
              setRetries((value) => value + 1);
            }, 700 * (retries + 1));
          }}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}

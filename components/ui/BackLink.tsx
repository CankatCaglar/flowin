"use client";

import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

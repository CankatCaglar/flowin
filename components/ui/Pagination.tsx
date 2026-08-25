"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { visiblePages } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  prevLabel,
  nextLabel,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const pages = visiblePages(page, pageCount);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={prevLabel}
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-jam/10 text-muted disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={cn(
              "h-8 w-8 rounded-lg border text-sm font-medium",
              item === page
                ? "border-barney bg-barney/10 text-ink"
                : "border-purple-jam/10 text-muted hover:bg-canvas",
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label={nextLabel}
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-jam/10 text-muted disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

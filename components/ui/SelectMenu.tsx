"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useMenu } from "@/contexts/MenuContext";
import { useDismissable } from "@/hooks/useDismissable";
import { cn } from "@/lib/utils";

/** ~4 option rows; menus always open downward and scroll inside. */
const OPTION_LIST_MAX = 176;

export const selectPanelClass =
  "overflow-hidden rounded-xl border border-purple-jam/10 bg-white shadow-xl";

export const selectListClass =
  "overflow-y-auto overscroll-contain py-1.5 [scrollbar-width:thin]";

export function selectOptionClass(selected: boolean) {
  return cn(
    "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
    "hover:bg-barney hover:text-white",
    selected ? "font-medium text-ink" : "text-ink",
  );
}

export function SelectOptionCheck({ selected }: { selected: boolean }) {
  return (
    <Check
      className={cn(
        "h-4 w-4 shrink-0",
        selected ? "text-ink group-hover:text-white" : "text-transparent",
      )}
    />
  );
}

export function useAnchoredMenuStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  {
    align = "left",
    maxHeight = OPTION_LIST_MAX,
    matchWidth = false,
    placement = "down",
    compact = false,
  }: {
    align?: "left" | "right";
    maxHeight?: number;
    matchWidth?: boolean;
    placement?: "down" | "end";
    compact?: boolean;
  } = {},
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const node = anchorRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
      const viewportRight = viewport
        ? viewport.offsetLeft + viewport.width
        : window.innerWidth;
      const next: CSSProperties = {
        position: "fixed",
        zIndex: 80,
        minWidth: matchWidth ? rect.width : Math.max(rect.width, 140),
      };
      if (matchWidth) next.width = rect.width;

      if (placement === "end") {
        const left = rect.right + 8;
        next.left = Math.min(left, Math.max(8, viewportRight - 188));
        if (compact) {
          next.bottom = window.innerHeight - rect.bottom;
        } else {
          next.top = rect.top;
          next.maxHeight = Math.min(maxHeight, Math.max(0, viewportBottom - rect.top - 12));
        }
      } else {
        next.top = rect.bottom + 4;
        if (!compact) {
          next.maxHeight = Math.min(maxHeight, Math.max(0, viewportBottom - rect.bottom - 12));
        }
        if (align === "right") {
          next.right = window.innerWidth - rect.right;
        } else {
          next.left = rect.left;
        }
      }
      setStyle(next);
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, align, anchorRef, compact, matchWidth, maxHeight, placement]);

  return style;
}

export function AnchoredMenu({
  open,
  anchorRef,
  align = "left",
  maxHeight = OPTION_LIST_MAX,
  matchWidth = false,
  placement = "down",
  compact = false,
  className,
  children,
  panelRef,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "left" | "right";
  maxHeight?: number;
  matchWidth?: boolean;
  placement?: "down" | "end";
  compact?: boolean;
  className?: string;
  children: ReactNode;
  panelRef?: RefObject<HTMLDivElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const style = useAnchoredMenuStyle(open, anchorRef, {
    align,
    maxHeight,
    matchWidth,
    placement,
    compact,
  });
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={ref}
      style={style}
      className={cn(selectPanelClass, !compact && selectListClass, compact && "overflow-hidden py-1.5", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

export function SelectMenu({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  align = "left",
  className,
  triggerClassName,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
}) {
  const { open, toggle, close } = useMenu(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable([rootRef, panelRef], open, close);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-purple-jam/15 bg-white px-3 text-sm text-ink",
          triggerClassName,
        )}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      <AnchoredMenu
        open={open}
        anchorRef={rootRef}
        align={align}
        matchWidth
        panelRef={panelRef}
      >
        <div role="listbox">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={selectOptionClass(active)}
              >
                <SelectOptionCheck selected={active} />
                {option.label}
              </button>
            );
          })}
        </div>
      </AnchoredMenu>
    </div>
  );
}

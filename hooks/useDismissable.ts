"use client";

import { useEffect, type RefObject } from "react";

export function useDismissable(
  ref: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const refs = Array.isArray(ref) ? ref : [ref];

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const inside = refs.some((item) => item.current?.contains(event.target as Node));
      if (!inside) onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // refs are stable; omitting from deps avoids re-subscribing when callers pass `[a, b]`
  }, [open, onClose]);
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

interface MenuContextValue {
  openId: string | null;
  setOpenId: Dispatch<SetStateAction<string | null>>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const value = useMemo(() => ({ openId, setOpenId }), [openId]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(id: string) {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within MenuProvider");
  }

  const open = context.openId === id;
  const close = useCallback(() => {
    context.setOpenId((current) => (current === id ? null : current));
  }, [context, id]);
  const toggle = useCallback(() => {
    context.setOpenId((current) => (current === id ? null : id));
  }, [context, id]);

  return { open, close, toggle };
}

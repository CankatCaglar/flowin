"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clearAuthSession, writeSelectedBrandId } from "@/lib/storage";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  endSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error("invalid-credentials");
    }
    const next = (await response.json()) as AuthUser;
    writeSelectedBrandId(null);
    setUser(next);
  }, []);

  const endSession = useCallback(() => {
    clearAuthSession();
    setUser(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie clear is best-effort; local session still ends.
    }
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({ user, loading: false, signIn, signOut, endSession }),
    [user, signIn, signOut, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

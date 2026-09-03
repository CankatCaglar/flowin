"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { BrandDataProvider } from "@/contexts/BrandDataContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { MenuProvider } from "@/contexts/MenuContext";
import type { AuthUser } from "@/types";

export function AppProviders({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <BrandProvider>
        <BrandDataProvider>
          <DateRangeProvider>
            <MenuProvider>
              <div className="h-full">{children}</div>
            </MenuProvider>
          </DateRangeProvider>
        </BrandDataProvider>
      </BrandProvider>
    </AuthProvider>
  );
}

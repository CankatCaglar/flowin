"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { MenuProvider } from "@/contexts/MenuContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BrandProvider>
        <DateRangeProvider>
          <MenuProvider>
            <div className="h-full">{children}</div>
          </MenuProvider>
        </DateRangeProvider>
      </BrandProvider>
    </AuthProvider>
  );
}

"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useBrand } from "@/contexts/BrandContext";
import { readBrandsCache } from "@/lib/storage";
import type { Brand } from "@/types";

const BrandsSeedContext = createContext<Brand[]>([]);

export function useSeededBrands() {
  return useContext(BrandsSeedContext);
}

export function BrandsBootstrap({ children }: { children: React.ReactNode }) {
  const { brands } = useBrand();
  const [cached] = useState(() => readBrandsCache());
  const value = useMemo(
    () => (brands.length > 0 ? brands : cached),
    [brands, cached],
  );
  return <BrandsSeedContext.Provider value={value}>{children}</BrandsSeedContext.Provider>;
}

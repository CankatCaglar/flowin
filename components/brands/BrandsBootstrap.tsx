"use client";

import { createContext, useContext } from "react";
import { useBrand } from "@/contexts/BrandContext";
import type { Brand } from "@/types";

const BrandsSeedContext = createContext<Brand[]>([]);

export function useSeededBrands() {
  return useContext(BrandsSeedContext);
}

export function BrandsBootstrap({ children }: { children: React.ReactNode }) {
  const { brands } = useBrand();
  return <BrandsSeedContext.Provider value={brands}>{children}</BrandsSeedContext.Provider>;
}

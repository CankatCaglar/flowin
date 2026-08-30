"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createBrand, deleteBrand, fetchBrands, updateBrand } from "@/lib/brands-api";
import { readSelectedBrandId, writeSelectedBrandId } from "@/lib/storage";
import type { Brand } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface BrandContextValue {
  brands: Brand[];
  selectedBrand: Brand | null;
  loading: boolean;
  selectBrand: (brandId: string | null) => void;
  addBrand: (input: {
    name: string;
    avatarColor: string;
    linkedinSub: string;
    linkedinEmail?: string;
    avatarUrl?: string;
  }) => Promise<Brand>;
  editBrand: (
    brandId: string,
    input: {
      name?: string;
      avatarColor?: string;
      pacing?: { dailyInvites: number; dailyMessages: number; dailyViews: number };
    },
  ) => Promise<void>;
  removeBrand: (brandId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let next: Brand[] = [];
      try {
        next = await fetchBrands();
      } catch {
        next = [];
      }
      setBrands(next);
      const stored = readSelectedBrandId();
      setSelectedBrandId((current) => {
        const candidate = current ?? stored;
        if (candidate && next.some((brand) => brand.id === candidate)) {
          return candidate;
        }
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBrands([]);
      setSelectedBrandId(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [user, authLoading, refresh]);

  const selectBrand = useCallback((brandId: string | null) => {
    setSelectedBrandId(brandId);
    writeSelectedBrandId(brandId);
  }, []);

  const addBrand = useCallback(
    async (input: {
      name: string;
      avatarColor: string;
      linkedinSub: string;
      linkedinEmail?: string;
      avatarUrl?: string;
    }) => {
      const brand = await createBrand(input);
      setBrands((current) => {
        if (current.some((item) => item.id === brand.id || item.linkedinSub === brand.linkedinSub)) {
          return current.map((item) =>
            item.id === brand.id || item.linkedinSub === brand.linkedinSub ? brand : item,
          );
        }
        return [...current, brand];
      });
      return brand;
    },
    [],
  );

  const editBrand = useCallback(
    async (
      brandId: string,
      input: {
        name?: string;
        avatarColor?: string;
        pacing?: { dailyInvites: number; dailyMessages: number; dailyViews: number };
      },
    ) => {
      const next = await updateBrand(brandId, input);
      setBrands((current) =>
        current.map((brand) => (brand.id === brandId ? next : brand)),
      );
      setSelectedBrandId((current) => {
        if (current !== brandId || next.id === brandId) return current;
        writeSelectedBrandId(next.id);
        return next.id;
      });
    },
    [],
  );

  const removeBrand = useCallback(
    async (brandId: string) => {
      await deleteBrand(brandId);
      setBrands((current) => current.filter((brand) => brand.id !== brandId));
      setSelectedBrandId((current) => {
        if (current !== brandId) return current;
        writeSelectedBrandId(null);
        return null;
      });
    },
    [],
  );

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  );

  const value = useMemo(
    () => ({
      brands,
      selectedBrand,
      loading,
      selectBrand,
      addBrand,
      editBrand,
      removeBrand,
      refresh,
    }),
    [brands, selectedBrand, loading, selectBrand, addBrand, editBrand, removeBrand, refresh],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within BrandProvider");
  }
  return context;
}

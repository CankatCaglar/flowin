"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  failed: boolean;
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
      pacing?: {
        dailyInvites: number;
        dailyMessages: number;
        dailyViews: number;
        dailyInmails: number;
      };
      schedule?: { startHour: number; endHour: number; weekdays: number[] };
      outreachPaused?: boolean;
      testMode?: boolean;
      archived?: boolean;
      alerts?: {
        connectionLost: boolean;
        sendFailed: boolean;
        lowLeads: boolean;
        dailyCap: boolean;
      };
      disconnectOutreach?: boolean;
    },
  ) => Promise<void>;
  removeBrand: (brandId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

const LOAD_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, endSession } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const ready = useRef(false);

  const refresh = useCallback(async () => {
    if (!ready.current) setLoading(true);
    setFailed(false);
    try {
      // A dropped session or a hiccup on the Firestore call used to leave the
      // brands page silently empty, so retry before giving up.
      for (let attempt = 0; ; attempt += 1) {
        try {
          const next = await fetchBrands();
          ready.current = true;
          setBrands(next);
          const stored = readSelectedBrandId();
          setSelectedBrandId((current) => {
            const candidate = current ?? stored;
            return candidate && next.some((brand) => brand.id === candidate) ? candidate : null;
          });
          return;
        } catch (error) {
          if (error instanceof Error && error.message === "unauthorized") {
            setBrands([]);
            setSelectedBrandId(null);
            endSession();
            return;
          }
          if (attempt >= LOAD_RETRIES) {
            setFailed(true);
            return;
          }
          await wait(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [endSession]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      ready.current = false;
      setBrands([]);
      setSelectedBrandId(null);
      setFailed(false);
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
        pacing?: {
          dailyInvites: number;
          dailyMessages: number;
          dailyViews: number;
          dailyInmails: number;
        };
        schedule?: { startHour: number; endHour: number; weekdays: number[] };
        outreachPaused?: boolean;
        testMode?: boolean;
        archived?: boolean;
        alerts?: {
          connectionLost: boolean;
          sendFailed: boolean;
          lowLeads: boolean;
          dailyCap: boolean;
        };
        disconnectOutreach?: boolean;
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
      failed,
      selectBrand,
      addBrand,
      editBrand,
      removeBrand,
      refresh,
    }),
    [brands, selectedBrand, loading, failed, selectBrand, addBrand, editBrand, removeBrand, refresh],
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

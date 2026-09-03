"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/contexts/BrandContext";
import { readSelectedBrandId } from "@/lib/storage";
import {
  fetchCampaigns,
  fetchDailyStats,
  fetchLeads,
  fetchMessages,
  hydrateLeadAvatars,
  leadNeedsAvatarHydration,
} from "@/lib/outreach-api";
import type { Campaign, DailyStat, Lead, OutreachMessage } from "@/types";

type BrandDataValue = {
  campaigns: Campaign[];
  leads: Lead[];
  stats: DailyStat[];
  messages: OutreachMessage[];
  loading: boolean;
  refresh: () => void;
};

const BrandDataContext = createContext<BrandDataValue | null>(null);

export function BrandDataProvider({ children }: { children: React.ReactNode }) {
  const { selectedBrand } = useBrand();
  const [storedBrandId, setStoredBrandId] = useState<string | null>(null);
  useEffect(() => {
    setStoredBrandId(readSelectedBrandId());
  }, [selectedBrand?.id]);
  const brandId = selectedBrand?.id ?? storedBrandId;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(brandId));
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedFor = useRef<string | null>(null);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!brandId) {
      setCampaigns([]);
      setLeads([]);
      setStats([]);
      setMessages([]);
      setLoading(false);
      loadedFor.current = null;
      return;
    }

    let cancelled = false;
    if (loadedFor.current !== brandId) setLoading(true);

    Promise.all([
      fetchCampaigns(brandId),
      fetchLeads(brandId),
      fetchDailyStats(brandId),
      fetchMessages(brandId),
    ])
      .then(([nextCampaigns, nextLeads, nextStats, nextMessages]) => {
        if (cancelled) return;
        loadedFor.current = brandId;
        setCampaigns(nextCampaigns);
        setLeads(nextLeads);
        setStats(nextStats);
        setMessages(nextMessages);
        setLoading(false);
        const pending = nextLeads.filter(leadNeedsAvatarHydration);
        if (!pending.length) return;
        void hydrateLeadAvatars(brandId).then(({ avatars, companies }) => {
          if (cancelled) return;
          if (!Object.keys(avatars).length && !Object.keys(companies).length) return;
          setLeads((current) =>
            current.map((lead) => {
              const avatarUrl = avatars[lead.id];
              const company = companies[lead.id]?.trim();
              if (!avatarUrl && !company) return lead;
              return {
                ...lead,
                ...(avatarUrl ? { avatarUrl, avatarChecked: true } : {}),
                ...(company && !lead.company.trim() ? { company } : {}),
              };
            }),
          );
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (loadedFor.current !== brandId) {
          setCampaigns([]);
          setLeads([]);
          setStats([]);
          setMessages([]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, refreshKey]);

  const value = useMemo(
    () => ({ campaigns, leads, stats, messages, loading, refresh }),
    [campaigns, leads, stats, messages, loading, refresh],
  );

  return <BrandDataContext.Provider value={value}>{children}</BrandDataContext.Provider>;
}

export function useSharedBrandData() {
  const context = useContext(BrandDataContext);
  if (!context) {
    throw new Error("useBrandData must be used within BrandDataProvider");
  }
  return context;
}

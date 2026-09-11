"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/contexts/BrandContext";
import {
  invalidateBrandBundle,
  peekBrandBundle,
  putBrandBundle,
  warmBrandBundle,
} from "@/lib/brand-data-cache";
import { isLeadFlowTerminal } from "@/lib/leads";
import { hydrateLeadAvatars, leadNeedsAvatarHydration } from "@/lib/outreach-api";
import { readSelectedBrandId } from "@/lib/storage";
import type { Campaign, DailyStat, Lead, OutreachMessage } from "@/types";

type BrandDataValue = {
  campaigns: Campaign[];
  leads: Lead[];
  stats: DailyStat[];
  messages: OutreachMessage[];
  loading: boolean;
  refresh: () => void;
  patchCampaign: (campaignId: string, patch: Partial<Campaign>) => void;
};

const BrandDataContext = createContext<BrandDataValue | null>(null);

export function BrandDataProvider({ children }: { children: React.ReactNode }) {
  const { selectedBrand } = useBrand();
  const [storedBrandId, setStoredBrandId] = useState<string | null>(null);
  useEffect(() => {
    setStoredBrandId(readSelectedBrandId());
  }, [selectedBrand?.id]);
  const brandId = selectedBrand?.id ?? storedBrandId;
  const cached = brandId ? peekBrandBundle(brandId) : null;
  const [campaigns, setCampaigns] = useState<Campaign[]>(cached?.campaigns ?? []);
  const [leads, setLeads] = useState<Lead[]>(cached?.leads ?? []);
  const [stats, setStats] = useState<DailyStat[]>(cached?.stats ?? []);
  const [messages, setMessages] = useState<OutreachMessage[]>(cached?.messages ?? []);
  const [loading, setLoading] = useState(Boolean(brandId) && !cached);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedFor = useRef<string | null>(cached && brandId ? brandId : null);
  const refresh = useCallback(() => {
    if (brandId) invalidateBrandBundle(brandId);
    setRefreshKey((value) => value + 1);
  }, [brandId]);

  const patchCampaign = useCallback((campaignId: string, patch: Partial<Campaign>) => {
    setCampaigns((current) => {
      const next = current.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, ...patch } : campaign,
      );
      if (brandId) {
        const existing = peekBrandBundle(brandId);
        if (existing) putBrandBundle(brandId, { ...existing, campaigns: next });
      }
      return next;
    });
    if (patch.status === "completed") {
      setLeads((current) => {
        const next = current.map((lead) => {
          if (lead.campaignId !== campaignId || isLeadFlowTerminal(lead)) return lead;
          return { ...lead, nextStepId: "", nextStepAt: undefined, awaiting: "" as const };
        });
        if (brandId) {
          const existing = peekBrandBundle(brandId);
          if (existing) putBrandBundle(brandId, { ...existing, leads: next });
        }
        return next;
      });
    }
  }, [brandId]);

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
    const existing = peekBrandBundle(brandId);
    if (existing) {
      setCampaigns(existing.campaigns);
      setLeads(existing.leads);
      setStats(existing.stats);
      setMessages(existing.messages);
      setLoading(false);
      loadedFor.current = brandId;
    } else if (loadedFor.current !== brandId) {
      setLoading(true);
    }

    void warmBrandBundle(brandId)
      .then((bundle) => {
        if (cancelled) return;
        putBrandBundle(brandId, bundle);
        loadedFor.current = brandId;
        setCampaigns(bundle.campaigns);
        setLeads(bundle.leads);
        setStats(bundle.stats);
        setMessages(bundle.messages);
        setLoading(false);
        const pending = bundle.leads.filter(leadNeedsAvatarHydration);
        if (!pending.length) return;
        void hydrateLeadAvatars(brandId).then(({ avatars, companies }) => {
          if (cancelled) return;
          if (!Object.keys(avatars).length && !Object.keys(companies).length) return;
          setLeads((current) => {
            const next = current.map((lead) => {
              const avatarUrl = avatars[lead.id];
              const company = companies[lead.id]?.trim();
              if (!avatarUrl && !company) return lead;
              return {
                ...lead,
                ...(avatarUrl ? { avatarUrl, avatarChecked: true } : {}),
                ...(company && !lead.company.trim() ? { company } : {}),
              };
            });
            putBrandBundle(brandId, {
              campaigns: bundle.campaigns,
              leads: next,
              stats: bundle.stats,
              messages: bundle.messages,
            });
            return next;
          });
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
    () => ({ campaigns, leads, stats, messages, loading, refresh, patchCampaign }),
    [campaigns, leads, stats, messages, loading, refresh, patchCampaign],
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

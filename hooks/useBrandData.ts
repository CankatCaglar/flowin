"use client";

import { useEffect, useState } from "react";
import { useSharedBrandData } from "@/contexts/BrandDataContext";
import { fetchDailyStats } from "@/lib/outreach-api";
import type { DailyStat } from "@/types";

export function useBrandData(brandId: string | null, campaignId?: string) {
  const shared = useSharedBrandData();
  const [campaignStats, setCampaignStats] = useState<DailyStat[] | null>(null);

  useEffect(() => {
    if (!brandId || !campaignId) {
      setCampaignStats(null);
      return;
    }
    let cancelled = false;
    void fetchDailyStats(brandId, campaignId).then((rows) => {
      if (!cancelled) setCampaignStats(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [brandId, campaignId]);

  return {
    campaigns: shared.campaigns,
    leads: shared.leads,
    stats: campaignStats ?? shared.stats,
    messages: shared.messages,
    loading: shared.loading,
    refresh: shared.refresh,
  };
}

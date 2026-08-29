"use client";

import { useEffect, useState } from "react";
import { fetchCampaigns, fetchDailyStats, fetchLeads } from "@/lib/local-data";
import type { Campaign, DailyStat, Lead } from "@/types";

export function useBrandData(brandId: string | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    if (!brandId) {
      setCampaigns([]);
      setLeads([]);
      setStats([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchCampaigns(brandId),
      fetchLeads(brandId),
      fetchDailyStats(brandId),
    ])
      .then(([nextCampaigns, nextLeads, nextStats]) => {
        if (cancelled) return;
        setCampaigns(nextCampaigns);
        setLeads(nextLeads);
        setStats(nextStats);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, refreshKey]);

  return { campaigns, leads, stats, loading, refresh };
}

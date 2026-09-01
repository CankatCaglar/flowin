"use client";

import { useEffect, useState } from "react";
import {
  fetchCampaigns,
  fetchDailyStats,
  fetchLeads,
  fetchMessages,
  hydrateLeadAvatars,
  leadNeedsAvatarHydration,
} from "@/lib/outreach-api";
import type { Campaign, DailyStat, Lead, OutreachMessage } from "@/types";

export function useBrandData(brandId: string | null, campaignId?: string) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    if (!brandId) {
      setCampaigns([]);
      setLeads([]);
      setStats([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchCampaigns(brandId),
      fetchLeads(brandId),
      fetchDailyStats(brandId, campaignId),
      fetchMessages(brandId),
    ])
      .then(([nextCampaigns, nextLeads, nextStats, nextMessages]) => {
        if (cancelled) return;
        setCampaigns(nextCampaigns);
        setLeads(nextLeads);
        setStats(nextStats);
        setMessages(nextMessages);
        const pending = nextLeads.filter(leadNeedsAvatarHydration);
        if (!pending.length) return;
        void hydrateLeadAvatars(brandId).then((avatars) => {
          if (cancelled || !Object.keys(avatars).length) return;
          setLeads((current) =>
            current.map((lead) =>
              lead.id in avatars
                ? { ...lead, avatarUrl: avatars[lead.id] ?? "", avatarChecked: true }
                : lead,
            ),
          );
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCampaigns([]);
        setLeads([]);
        setStats([]);
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, campaignId, refreshKey]);

  return { campaigns, leads, stats, messages, loading, refresh };
}

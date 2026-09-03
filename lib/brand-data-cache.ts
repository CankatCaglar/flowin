import {
  fetchCampaigns,
  fetchDailyStats,
  fetchLeads,
  fetchMessages,
} from "@/lib/outreach-api";
import type { Campaign, DailyStat, Lead, OutreachMessage } from "@/types";

export type BrandBundle = {
  campaigns: Campaign[];
  leads: Lead[];
  stats: DailyStat[];
  messages: OutreachMessage[];
};

const inflight = new Map<string, Promise<BrandBundle>>();
const cache = new Map<string, BrandBundle>();

export function peekBrandBundle(brandId: string) {
  return cache.get(brandId) ?? null;
}

export function warmBrandBundle(brandId: string) {
  const hit = cache.get(brandId);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(brandId);
  if (pending) return pending;
  const job = Promise.all([
    fetchCampaigns(brandId),
    fetchLeads(brandId),
    fetchDailyStats(brandId),
    fetchMessages(brandId),
  ]).then(([campaigns, leads, stats, messages]) => {
    const bundle = { campaigns, leads, stats, messages };
    cache.set(brandId, bundle);
    inflight.delete(brandId);
    return bundle;
  });
  inflight.set(brandId, job);
  return job;
}

export function putBrandBundle(brandId: string, bundle: BrandBundle) {
  cache.set(brandId, bundle);
}

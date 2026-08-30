import type { Brand, Campaign } from "@/types";

const AUTH_KEY = "flowin.auth";
const BRAND_KEY = "flowin.selectedBrandId";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}

export function readAuthSession() {
  return readJson<{ uid: string; email: string; displayName: string }>(AUTH_KEY);
}

export function writeAuthSession(user: { uid: string; email: string; displayName: string }) {
  writeJson(AUTH_KEY, user);
}

export function clearAuthSession() {
  removeKey(AUTH_KEY);
}

export function readSelectedBrandId() {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(BRAND_KEY);
}

export function writeSelectedBrandId(brandId: string | null) {
  if (!canUseStorage()) return;
  if (brandId) window.localStorage.setItem(BRAND_KEY, brandId);
  else window.localStorage.removeItem(BRAND_KEY);
}

export function hydrateBrandDates(brand: Brand): Brand {
  return {
    ...brand,
    createdAt: brand.createdAt instanceof Date ? brand.createdAt : new Date(brand.createdAt),
  };
}

export function hydrateCampaignDates(campaign: Campaign): Campaign {
  return {
    ...campaign,
    startDate:
      campaign.startDate instanceof Date ? campaign.startDate : new Date(campaign.startDate),
    endDate: campaign.endDate instanceof Date ? campaign.endDate : new Date(campaign.endDate),
    createdAt:
      campaign.createdAt instanceof Date ? campaign.createdAt : new Date(campaign.createdAt),
  };
}

import type { Brand, Campaign } from "@/types";

const AUTH_KEY = "flowin.auth";
const BRAND_KEY = "flowin.selectedBrandId";

function canUseStorage() {
  return typeof window !== "undefined";
}

// The session itself lives in the httpOnly admin cookie; this only clears the
// legacy browser copy.
export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_KEY);
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
    unipileSyncedAt: brand.unipileSyncedAt
      ? brand.unipileSyncedAt instanceof Date
        ? brand.unipileSyncedAt
        : new Date(brand.unipileSyncedAt)
      : undefined,
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

import "server-only";
import {
  downloadLeadAvatarImage,
  isRemoteAvatarUrl,
  isStoredLeadAvatarUrl,
  leadAvatarUrl,
  readLeadAvatar,
  type AvatarImage,
} from "@/lib/brand-avatar";
import { fetchBrand } from "@/lib/data";
import { fetchLead, saveLead } from "@/lib/outreach-data";
import { getUnipileProfile, unipilePictureUrl } from "@/lib/unipile";
import { resolveBrandUnipileAccount } from "@/lib/unipile-sync";

const inflight = new Map<string, Promise<AvatarImage | null>>();
const brandSeats = new Map<string, string>();
let unipileActive = 0;
const unipileWait: Array<() => void> = [];

export async function ensureLeadPhoto(leadId: string): Promise<AvatarImage | null> {
  const pending = inflight.get(leadId);
  if (pending) return pending;
  const job = resolveLeadPhoto(leadId).finally(() => inflight.delete(leadId));
  inflight.set(leadId, job);
  return job;
}

async function resolveLeadPhoto(leadId: string): Promise<AvatarImage | null> {
  const stored = await readLeadAvatar(leadId);
  if (stored) return stored;

  const lead = await fetchLead(leadId);
  if (!lead) return null;

  if (isRemoteAvatarUrl(lead.avatarUrl ?? "")) {
    const image = await downloadLeadAvatarImage(leadId, lead.avatarUrl);
    if (image) {
      lead.avatarUrl = leadAvatarUrl(leadId);
      await saveLead(lead);
      return image;
    }
  }

  if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) {
    return readLeadAvatar(leadId);
  }

  const brand = await fetchBrand(lead.brandId);
  let accountId = await accountIdForBrand(brand);
  if (!accountId) return null;

  const identifier = lead.linkedinPublicId || lead.unipileProviderId || lead.linkedinUrl;
  if (!identifier) return null;

  const pictureUrl = await withUnipileSlot(async () => {
    let profile: Awaited<ReturnType<typeof getUnipileProfile>>;
    try {
      profile = await getUnipileProfile(accountId, identifier);
    } catch (error) {
      if (!isMissingAccount(error)) throw error;
      brandSeats.delete(brand?.id ?? "");
      accountId = await accountIdForBrand(brand, accountId);
      if (!accountId) throw error;
      profile = await getUnipileProfile(accountId, identifier);
    }
    if (profile.provider_id && !lead.unipileProviderId) {
      lead.unipileProviderId = profile.provider_id;
    }
    if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
    const picture = unipilePictureUrl(profile);
    if (!picture) {
      console.error("[lead-avatar] no picture on profile", leadId, Object.keys(profile));
    }
    return picture;
  }).catch((error) => {
    console.error(
      "[lead-avatar] unipile profile failed:",
      leadId,
      error instanceof Error ? error.message : error,
    );
    return "";
  });

  if (!pictureUrl) return null;
  const image = await downloadLeadAvatarImage(leadId, pictureUrl);
  lead.avatarUrl = image ? leadAvatarUrl(leadId) : pictureUrl;
  await saveLead(lead);
  return image;
}

async function accountIdForBrand(
  brand: Awaited<ReturnType<typeof fetchBrand>>,
  skipId?: string,
) {
  if (!brand) return "";
  const cached = brandSeats.get(brand.id);
  if (cached && cached !== skipId) return cached;
  try {
    const accountId = await resolveBrandUnipileAccount({
      id: brand.id,
      name: brand.name,
      linkedinEmail: brand.linkedinEmail,
      unipileAccountId: brand.unipileAccountId,
      skipIds: skipId ? [skipId] : [],
    });
    if (accountId) {
      brandSeats.set(brand.id, accountId);
      return accountId;
    }
  } catch (error) {
    console.error(
      "[lead-avatar] seat lookup failed:",
      brand.id,
      error instanceof Error ? error.message : error,
    );
  }
  return "";
}

function isMissingAccount(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /account not found/i.test(message);
}

function withUnipileSlot<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      unipileActive += 1;
      try {
        resolve(await fn());
      } catch (error) {
        reject(error);
      } finally {
        unipileActive -= 1;
        unipileWait.shift()?.();
      }
    };
    if (unipileActive >= 2) {
      unipileWait.push(run);
      return;
    }
    void run();
  });
}

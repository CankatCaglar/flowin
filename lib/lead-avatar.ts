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
import { getUnipileProfileLite, UnipileError, unipilePictureUrl } from "@/lib/unipile";
import { resolveBrandUnipileAccount } from "@/lib/unipile-sync";
import type { Lead } from "@/types";

const UNIPILE_CONCURRENCY = 6;
const HYDRATE_CONCURRENCY = 8;
const hydrateInflight = new Map<string, Promise<string>>();
const brandSeats = new Map<string, string>();
let unipileActive = 0;
const unipileWait: Array<() => void> = [];

export async function serveLeadPhoto(leadId: string): Promise<AvatarImage | null> {
  const stored = await readLeadAvatar(leadId);
  if (stored) return stored;

  const lead = await fetchLead(leadId);
  if (!lead) return null;

  if (isRemoteAvatarUrl(lead.avatarUrl ?? "")) {
    const image = await downloadLeadAvatarImage(leadId, lead.avatarUrl);
    if (image) {
      lead.avatarUrl = leadAvatarUrl(leadId);
      lead.avatarChecked = true;
      await saveLead(lead);
    }
    return image;
  }

  if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) {
    return readLeadAvatar(leadId);
  }

  return null;
}

export async function hydrateLeadAvatars(leads: Lead[]): Promise<Record<string, string>> {
  const avatars: Record<string, string> = {};
  for (const lead of leads) {
    if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) {
      avatars[lead.id] = leadAvatarUrl(lead.id);
    }
  }

  const pending = leads.filter(needsAvatarHydration);
  if (!pending.length) return avatars;

  const brandIds = [...new Set(pending.map((lead) => lead.brandId))];
  await Promise.all(
    brandIds.map(async (brandId) => {
      const brand = await fetchBrand(brandId);
      await accountIdForBrand(brand);
    }),
  );

  await mapPool(pending, HYDRATE_CONCURRENCY, async (lead) => {
    const url = await hydrateLeadAvatar(lead);
    if (url || lead.avatarChecked) avatars[lead.id] = url;
  });
  return avatars;
}

function needsAvatarHydration(lead: Lead) {
  if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) return false;
  return !lead.avatarChecked;
}

async function hydrateLeadAvatar(lead: Lead): Promise<string> {
  const pending = hydrateInflight.get(lead.id);
  if (pending) return pending;
  const job = hydrateLeadAvatarUncached(lead).finally(() => hydrateInflight.delete(lead.id));
  hydrateInflight.set(lead.id, job);
  return job;
}

async function hydrateLeadAvatarUncached(lead: Lead): Promise<string> {
  try {
    const url = await resolveStoredPhoto(lead);
    lead.avatarUrl = url;
    lead.avatarChecked = true;
    await saveLead(lead);
    return url;
  } catch (error) {
    if (error instanceof UnipileError && error.retryable) return "";
    console.error(
      "[lead-avatar] hydrate failed:",
      lead.id,
      error instanceof Error ? error.message : error,
    );
    lead.avatarChecked = true;
    await saveLead(lead).catch(() => undefined);
    return "";
  }
}

async function resolveStoredPhoto(lead: Lead): Promise<string> {
  if (await readLeadAvatar(lead.id)) {
    return leadAvatarUrl(lead.id);
  }

  if (isRemoteAvatarUrl(lead.avatarUrl ?? "")) {
    const image = await downloadLeadAvatarImage(lead.id, lead.avatarUrl);
    if (image) return leadAvatarUrl(lead.id);
  }

  const pictureUrl = await fetchUnipilePicture(lead);
  if (!pictureUrl) return "";
  const image = await downloadLeadAvatarImage(lead.id, pictureUrl);
  return image ? leadAvatarUrl(lead.id) : "";
}

async function fetchUnipilePicture(lead: Lead): Promise<string> {
  const brand = await fetchBrand(lead.brandId);
  let accountId = await accountIdForBrand(brand);
  if (!accountId) return "";

  const identifiers = profileIdentifiers(lead);
  if (!identifiers.length) return "";

  return withUnipileSlot(async () => {
    let lastError: unknown;
    for (const identifier of identifiers) {
      try {
        const profile = await getUnipileProfileLite(accountId, identifier);
        if (profile.provider_id) lead.unipileProviderId = profile.provider_id;
        if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
        return unipilePictureUrl(profile);
      } catch (error) {
        if (isMissingAccount(error)) {
          brandSeats.delete(brand?.id ?? "");
          accountId = await accountIdForBrand(brand, accountId);
          if (!accountId) throw error;
          const profile = await getUnipileProfileLite(accountId, identifier);
          if (profile.provider_id) lead.unipileProviderId = profile.provider_id;
          if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
          return unipilePictureUrl(profile);
        }
        if (error instanceof UnipileError && error.retryable) throw error;
        if (isUnusableIdentifier(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    if (lastError) {
      console.error(
        "[lead-avatar] unipile profile failed:",
        lead.id,
        lastError instanceof Error ? lastError.message : lastError,
      );
    }
    return "";
  });
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

function profileIdentifiers(lead: Lead) {
  const values = [lead.unipileProviderId, lead.linkedinPublicId, lead.linkedinUrl]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(values)];
}

function isMissingAccount(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /account not found/i.test(message);
}

function isUnusableIdentifier(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/account not found/i.test(message)) return false;
  return /recipient id is valid|profile is not locked|user not found|does not exist|not found/i.test(
    message,
  );
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
    if (unipileActive >= UNIPILE_CONCURRENCY) {
      unipileWait.push(run);
      return;
    }
    void run();
  });
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  if (!items.length) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}

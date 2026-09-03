import "server-only";
import {
  downloadLeadAvatarImage,
  isMissingLeadAvatar,
  isRemoteAvatarUrl,
  isStoredLeadAvatarUrl,
  leadAvatarUrl,
  MISSING_LEAD_AVATAR,
  readLeadAvatar,
  type AvatarImage,
} from "@/lib/brand-avatar";
import { fetchBrand } from "@/lib/data";
import { companyFromHeadline, companyFromProfileRecord } from "@/lib/linkedin-company";
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
  if (isMissingLeadAvatar(lead.avatarUrl ?? "")) return null;

  if (isRemoteAvatarUrl(lead.avatarUrl ?? "")) {
    const image = await downloadLeadAvatarImage(leadId, lead.avatarUrl);
    if (image) {
      lead.avatarUrl = leadAvatarUrl(leadId);
      lead.avatarChecked = true;
      await saveLead(lead);
      return image;
    }
  }

  const url = await hydrateLeadAvatar(lead);
  if (!url) return null;
  return readLeadAvatar(leadId);
}

export async function hydrateLeadAvatars(leads: Lead[]): Promise<{
  avatars: Record<string, string>;
  companies: Record<string, string>;
}> {
  const avatars: Record<string, string> = {};
  const companies: Record<string, string> = {};
  for (const lead of leads) {
    if (isStoredLeadAvatarUrl(lead.avatarUrl ?? "")) {
      avatars[lead.id] = leadAvatarUrl(lead.id);
    }
  }

  const pending = leads.filter(needsAvatarHydration);
  if (!pending.length) return { avatars, companies };

  const brandIds = [...new Set(pending.map((lead) => lead.brandId))];
  await Promise.all(
    brandIds.map(async (brandId) => {
      const brand = await fetchBrand(brandId);
      await accountIdForBrand(brand);
    }),
  );

  await mapPool(pending, HYDRATE_CONCURRENCY, async (lead) => {
    const url = await hydrateLeadAvatar(lead);
    if (url) avatars[lead.id] = url;
    if (lead.company.trim()) companies[lead.id] = lead.company;
  });
  return { avatars, companies };
}

function needsAvatarHydration(lead: Lead) {
  const url = lead.avatarUrl ?? "";
  if (isStoredLeadAvatarUrl(url) || isMissingLeadAvatar(url)) return false;
  if (isRemoteAvatarUrl(url)) return true;
  return !lead.avatarChecked || !url;
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
    if (url) {
      lead.avatarUrl = url;
      lead.avatarChecked = true;
      await saveLead(lead);
      return url;
    }
    lead.avatarUrl = MISSING_LEAD_AVATAR;
    lead.avatarChecked = true;
    await saveLead(lead);
    return "";
  } catch (error) {
    if (error instanceof UnipileError && error.retryable) return "";
    console.error(
      "[lead-avatar] hydrate failed:",
      lead.id,
      error instanceof Error ? error.message : error,
    );
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

  const profile = await fetchUnipileProfile(lead);
  applyProfileCompany(lead, profile.company);
  if (!profile.pictureUrl) return "";
  const image = await downloadLeadAvatarImage(lead.id, profile.pictureUrl);
  if (image) return leadAvatarUrl(lead.id);
  lead.avatarUrl = profile.pictureUrl;
  throw new UnipileError("avatar-download-failed", 502, true);
}

async function fetchUnipileProfile(lead: Lead): Promise<{ pictureUrl: string; company: string }> {
  const brand = await fetchBrand(lead.brandId);
  let accountId = await accountIdForBrand(brand);
  if (!accountId) throw new UnipileError("unipile-seat-missing", 503, true);

  const identifiers = profileIdentifiers(lead);
  if (!identifiers.length) return { pictureUrl: "", company: "" };

  return withUnipileSlot(async () => {
    let lastError: unknown;
    for (const identifier of identifiers) {
      try {
        const profile = await getUnipileProfileLite(accountId, identifier);
        if (profile.provider_id) lead.unipileProviderId = profile.provider_id;
        if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
        return {
          pictureUrl: unipilePictureUrl(profile),
          company: companyFromProfileRecord(profile as unknown as Record<string, unknown>),
        };
      } catch (error) {
        if (isMissingAccount(error)) {
          brandSeats.delete(brand?.id ?? "");
          accountId = await accountIdForBrand(brand, accountId);
          if (!accountId) throw error;
          const profile = await getUnipileProfileLite(accountId, identifier);
          if (profile.provider_id) lead.unipileProviderId = profile.provider_id;
          if (profile.public_identifier) lead.linkedinPublicId = profile.public_identifier;
          return {
            pictureUrl: unipilePictureUrl(profile),
            company: companyFromProfileRecord(profile as unknown as Record<string, unknown>),
          };
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
    return { pictureUrl: "", company: "" };
  });
}

function applyProfileCompany(lead: Lead, company: string) {
  if (lead.company.trim()) return;
  const next = company.trim() || companyFromHeadline(lead.position);
  if (next) lead.company = next;
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

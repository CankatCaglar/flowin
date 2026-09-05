import "server-only";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  brandAvatarUrl,
  deleteBrandAvatar,
  ingestBrandAvatar,
  isRemoteAvatarUrl,
  isStoredAvatarUrl,
  moveBrandAvatar,
} from "@/lib/brand-avatar";
import { brandSlug, looksLikeAutoId } from "@/lib/brand-id";
import { requireFirebaseDb } from "@/lib/firebase";
import { deleteOutreachForBrand, fetchBrandSummaries } from "@/lib/outreach-data";
import {
  DEFAULT_PACING,
  DEFAULT_SCHEDULE,
  normalizeAlerts,
  normalizePacing,
  normalizeSchedule,
} from "@/lib/pacing";
import { hydrateBrandDates } from "@/lib/storage";
import type { Brand, BrandAlerts, BrandPacing, BrandSchedule, UnipileStatus } from "@/types";

function fallbackRemoteAvatar(url?: string) {
  const value = url?.trim() ?? "";
  return isRemoteAvatarUrl(value) ? value : "";
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

function asOptionalDate(value: unknown) {
  if (value == null || value === "") return undefined;
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asUnipileStatus(value: unknown): UnipileStatus {
  if (value === "running" || value === "disconnected" || value === "error") return value;
  return "none";
}

function hydrateBrandRecord(
  input: Partial<Brand> & Pick<Brand, "id" | "name">,
): Brand {
  return hydrateBrandDates({
    id: input.id,
    name: input.name,
    avatarColor: String(input.avatarColor ?? "#6D1472"),
    createdAt: asDate(input.createdAt),
    linkedinSub: String(input.linkedinSub ?? ""),
    linkedinEmail: String(input.linkedinEmail ?? ""),
    linkedinPublicId: String(input.linkedinPublicId ?? "").trim(),
    linkedinCompany: (() => {
      // Preserve the 3-way distinction coming from Firestore:
      //   undefined → field never written  → auto-fill allowed
      //   null      → user explicitly cleared → skip auto-fill
      //   "string"  → has a value           → skip auto-fill
      const raw = (input as { linkedinCompany?: string | null }).linkedinCompany;
      if (raw === undefined) return undefined;
      if (raw === null) return null;
      return String(raw).trim();
    })(),
    avatarUrl: String(input.avatarUrl ?? ""),
    unipileAccountId: String(input.unipileAccountId ?? ""),
    unipileStatus: asUnipileStatus(input.unipileStatus),
    unipileSyncedAt: asOptionalDate(input.unipileSyncedAt),
    pacing: normalizePacing(input.pacing),
    schedule: normalizeSchedule(input.schedule),
    outreachPaused: Boolean(input.outreachPaused),
    testMode: Boolean(input.testMode),
    archived: Boolean(input.archived),
    alerts: normalizeAlerts(input.alerts),
    activeCampaigns: Number(input.activeCampaigns ?? 0),
    successRate: Number(input.successRate ?? 0),
  });
}

async function uniqueBrandId(db: Firestore, name: string, reserved?: string) {
  const base = brandSlug(name);
  let candidate = base;
  let index = 2;
  while (true) {
    if (candidate === reserved) return candidate;
    const taken = (await db.collection("brands").doc(candidate).get()).exists;
    if (!taken) return candidate;
    candidate = `${base}-${index}`;
    index += 1;
  }
}

async function findBrandByLinkedInSub(db: Firestore, linkedinSub: string) {
  const snapshot = await db
    .collection("brands")
    .where("linkedinSub", "==", linkedinSub)
    .limit(1)
    .get();
  return snapshot.docs[0] ?? null;
}

async function migrateReadableBrandIds(db: Firestore) {
  const snapshot = await db.collection("brands").get();
  for (const item of snapshot.docs) {
    if (!looksLikeAutoId(item.id)) continue;
    const data = item.data();
    const name = String(data.name ?? "").trim();
    if (!name) continue;
    const nextId = await uniqueBrandId(db, name);
    if (nextId === item.id) continue;
    await moveBrandAvatar(item.id, nextId);
    const avatarUrl = isStoredAvatarUrl(String(data.avatarUrl ?? ""))
      ? brandAvatarUrl(nextId)
      : String(data.avatarUrl ?? "");
    await db.collection("brands").doc(nextId).set({ ...data, avatarUrl });
    await item.ref.delete();
  }
}

const remoteAvatarIngested = new Set<string>();

async function ingestStoredRemoteAvatar(
  db: Firestore,
  brandId: string,
  data: { avatarUrl?: unknown; linkedinSub?: unknown },
) {
  const remoteUrl = String(data.avatarUrl ?? "").trim();
  if (!isRemoteAvatarUrl(remoteUrl) || remoteAvatarIngested.has(brandId)) {
    return remoteUrl;
  }
  remoteAvatarIngested.add(brandId);
  const avatarUrl = await ingestBrandAvatar({
    brandId,
    linkedinSub: typeof data.linkedinSub === "string" ? data.linkedinSub : "",
    remoteUrl,
  });
  if (!avatarUrl) return remoteUrl;
  await db.collection("brands").doc(brandId).update({ avatarUrl });
  return avatarUrl;
}

export async function requireBrandDocs() {
  return (await requireFirebaseDb().collection("brands").get()).docs;
}

let brandIdsMigrated = false;

export async function fetchBrands(): Promise<Brand[]> {
  const snapshot = await requireFirebaseDb().collection("brands").get();
  return snapshot.docs.map((item) => {
    const data = item.data();
    return hydrateBrandRecord({
      id: item.id,
      name: String(data.name ?? ""),
      avatarColor: String(data.avatarColor ?? "#6D1472"),
      createdAt: asDate(data.createdAt),
      linkedinSub: data.linkedinSub,
      linkedinEmail: data.linkedinEmail,
      linkedinPublicId: data.linkedinPublicId,
      linkedinCompany: data.linkedinCompany,
      avatarUrl: String(data.avatarUrl ?? ""),
      unipileAccountId: data.unipileAccountId,
      unipileStatus: data.unipileStatus,
      unipileSyncedAt: data.unipileSyncedAt,
      pacing: data.pacing,
      schedule: data.schedule,
      outreachPaused: data.outreachPaused,
      testMode: data.testMode,
      archived: data.archived,
      alerts: data.alerts,
      activeCampaigns: Number(data.activeCampaigns ?? 0),
      successRate: Number(data.successRate ?? 0),
    });
  });
}

// Unipile lookups are slow, so they run after the response instead of blocking
// the brands list; the results are persisted for the next load.
async function backfillBrandPublicIds(brands: Brand[]) {
  const missing = brands.filter((brand) => brand.unipileAccountId && !brand.linkedinPublicId);
  if (missing.length === 0) return brands;
  try {
    const { listUnipileAccounts, unipileAccountPublicId } = await import("@/lib/unipile");
    const accounts = await listUnipileAccounts();
    const byId = new Map(accounts.map((account) => [account.id, unipileAccountPublicId(account)]));
    const db = requireFirebaseDb();
    return await Promise.all(
      brands.map(async (brand) => {
        const publicId = brand.unipileAccountId ? byId.get(brand.unipileAccountId) : "";
        if (!publicId || brand.linkedinPublicId) return brand;
        await db.collection("brands").doc(brand.id).update({ linkedinPublicId: publicId });
        return { ...brand, linkedinPublicId: publicId };
      }),
    );
  } catch (error) {
    console.error(
      "[unipile] public id backfill skipped:",
      error instanceof Error ? error.message : error,
    );
    return brands;
  }
}

async function fillBrandLinkedInCompany(brand: Brand) {
  // null = user explicitly cleared → respect that, don't re-fill
  if (brand.linkedinCompany !== undefined || !brand.unipileAccountId) return brand;
  try {
    const { fetchAccountCompany } = await import("@/lib/unipile");
    const company = await fetchAccountCompany(brand.unipileAccountId, brand.linkedinPublicId);
    console.info("[unipile] company", {
      brandId: brand.id,
      hasPublicId: Boolean(brand.linkedinPublicId),
      company: company || null,
    });
    if (!company) return brand;
    await requireFirebaseDb().collection("brands").doc(brand.id).update({ linkedinCompany: company });
    return { ...brand, linkedinCompany: company };
  } catch (error) {
    console.error(
      "[unipile] company lookup failed:",
      brand.id,
      error instanceof Error ? error.message : error,
    );
    return brand;
  }
}

async function enrichBrandCompanies(brands: Brand[]) {
  // null = explicitly cleared, undefined = never fetched; only auto-fill truly-missing ones
  const missing = brands.filter((brand) => brand.unipileAccountId && brand.linkedinCompany === undefined);
  if (missing.length === 0) return brands;
  const filled = await Promise.all(missing.map((brand) => fillBrandLinkedInCompany(brand)));
  const byId = new Map(filled.map((brand) => [brand.id, brand.linkedinCompany]));
  return brands.map((brand) => {
    const company = byId.get(brand.id);
    return company ? { ...brand, linkedinCompany: company } : brand;
  });
}

export async function runBrandListSideEffects(brands: Brand[]) {
  if (!brandIdsMigrated) {
    try {
      await migrateReadableBrandIds(requireFirebaseDb());
      brandIdsMigrated = true;
    } catch (error) {
      console.error(
        "[brands] id migrate skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  try {
    const { syncUnipileSeats } = await import("@/lib/unipile-sync");
    await syncUnipileSeats();
  } catch (error) {
    console.error("[unipile] seat sync skipped:", error instanceof Error ? error.message : error);
  }
  try {
    const summaries = await fetchBrandSummaries();
    const db = requireFirebaseDb();
    await Promise.all(
      brands.map((brand) => {
        const stats = summaries[brand.id];
        if (!stats) return undefined;
        return db.collection("brands").doc(brand.id).update({
          activeCampaigns: stats.activeCampaigns,
          successRate: stats.successRate,
        });
      }),
    );
  } catch (error) {
    console.error(
      "[brands] summary persist skipped:",
      error instanceof Error ? error.message : error,
    );
  }
  try {
    await enrichBrandCompanies(await backfillBrandPublicIds(brands));
  } catch (error) {
    console.error(
      "[unipile] company backfill skipped:",
      error instanceof Error ? error.message : error,
    );
  }
  const db = requireFirebaseDb();
  try {
    await Promise.all(
      brands
        .filter((brand) => isRemoteAvatarUrl(brand.avatarUrl ?? ""))
        .map((brand) =>
          ingestStoredRemoteAvatar(db, brand.id, {
            avatarUrl: brand.avatarUrl,
            linkedinSub: brand.linkedinSub,
          }),
        ),
    );
  } catch (error) {
    console.error(
      "[brands] avatar ingest skipped:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function createBrand(input: {
  name: string;
  avatarColor: string;
  linkedinSub: string;
  linkedinEmail?: string;
  avatarUrl?: string;
  linkedinPublicId?: string;
}) {
  const db = requireFirebaseDb();
  const linkedinSub = input.linkedinSub.trim();
  const existing = await findBrandByLinkedInSub(db, linkedinSub);
  if (existing) {
    const current = existing.data() ?? {};
    const avatarUrl =
      (await ingestBrandAvatar({
        brandId: existing.id,
        linkedinSub,
        remoteUrl: input.avatarUrl,
      })) ||
      fallbackRemoteAvatar(input.avatarUrl) ||
      String(current.avatarUrl ?? "");
    const linkedinEmail = input.linkedinEmail?.trim() || String(current.linkedinEmail ?? "");
    const updates: Record<string, string> = {};
    if (avatarUrl) updates.avatarUrl = avatarUrl;
    if (linkedinEmail && linkedinEmail !== current.linkedinEmail) {
      updates.linkedinEmail = linkedinEmail;
    }
    // Save vanity name when available and not already set
    const incomingPublicId = input.linkedinPublicId?.trim() ?? "";
    if (incomingPublicId && !current.linkedinPublicId) {
      updates.linkedinPublicId = incomingPublicId;
    }
    if (Object.keys(updates).length > 0) {
      await existing.ref.update(updates);
    }
    return hydrateBrandRecord({
      id: existing.id,
      name: String(current.name ?? input.name),
      avatarColor: String(current.avatarColor ?? input.avatarColor),
      createdAt: asDate(current.createdAt),
      linkedinSub,
      linkedinEmail,
      linkedinPublicId: current.linkedinPublicId,
      linkedinCompany: current.linkedinCompany,
      avatarUrl,
      unipileAccountId: current.unipileAccountId,
      unipileStatus: current.unipileStatus,
      pacing: current.pacing,
    });
  }
  const id = await uniqueBrandId(db, input.name.trim());
  const avatarUrl =
    (await ingestBrandAvatar({
      brandId: id,
      linkedinSub,
      remoteUrl: input.avatarUrl,
    })) || fallbackRemoteAvatar(input.avatarUrl);
  const payload = {
    name: input.name.trim(),
    avatarColor: input.avatarColor,
    createdAt: new Date(),
    linkedinSub,
    linkedinEmail: input.linkedinEmail?.trim() ?? "",
    linkedinPublicId: input.linkedinPublicId?.trim() ?? "",
    avatarUrl,
    unipileAccountId: "",
    unipileStatus: "none" as UnipileStatus,
    pacing: DEFAULT_PACING,
    schedule: DEFAULT_SCHEDULE,
    outreachPaused: false,
  };
  await db.collection("brands").doc(id).create({
    ...payload,
    createdAt: Timestamp.fromDate(payload.createdAt),
  });
  return hydrateBrandRecord({ id, ...payload });
}

export async function updateBrand(
  brandId: string,
  input: {
    name?: string;
    avatarColor?: string;
    pacing?: BrandPacing;
    schedule?: BrandSchedule;
    outreachPaused?: boolean;
    testMode?: boolean;
    archived?: boolean;
    alerts?: BrandAlerts;
    disconnectOutreach?: boolean;
    linkedinCompany?: string | null;
    linkedinPublicId?: string;
  },
) {
  const db = requireFirebaseDb();
  const ref = db.collection("brands").doc(brandId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("not-found");
  }
  const current = snapshot.data() ?? {};
  const name = (input.name ?? String(current.name ?? "")).trim();
  if (!name) throw new Error("invalid");
  const avatarColor = input.avatarColor ?? String(current.avatarColor ?? "#6D1472");
  const pacing = input.pacing ? normalizePacing(input.pacing) : normalizePacing(current.pacing);
  const schedule = input.schedule
    ? normalizeSchedule(input.schedule)
    : normalizeSchedule(current.schedule);
  const outreachPaused =
    input.outreachPaused !== undefined ? Boolean(input.outreachPaused) : Boolean(current.outreachPaused);
  const testMode = input.testMode !== undefined ? Boolean(input.testMode) : Boolean(current.testMode);
  const archived = input.archived !== undefined ? Boolean(input.archived) : Boolean(current.archived);
  const alerts = input.alerts ? normalizeAlerts(input.alerts) : normalizeAlerts(current.alerts);
  const unipileAccountId = input.disconnectOutreach ? "" : String(current.unipileAccountId ?? "");
  const unipileStatus = input.disconnectOutreach
    ? ("none" as UnipileStatus)
    : asUnipileStatus(current.unipileStatus);
  const nextId = await uniqueBrandId(db, name, brandId);
  let avatarUrl = String(current.avatarUrl ?? "");
  const fields = {
    name,
    avatarColor,
    avatarUrl,
    pacing,
    schedule,
    outreachPaused,
    testMode,
    archived,
    alerts,
    unipileAccountId,
    unipileStatus,
    ...(input.linkedinCompany !== undefined ? { linkedinCompany: input.linkedinCompany ?? null } : {}),
    ...(input.linkedinPublicId !== undefined
      ? { linkedinPublicId: input.linkedinPublicId.trim() }
      : {}),
  };
  const unipileSyncedAt = input.disconnectOutreach
    ? undefined
    : asOptionalDate(current.unipileSyncedAt);
  if (nextId !== brandId) {
    await moveBrandAvatar(brandId, nextId);
    if (isStoredAvatarUrl(avatarUrl)) {
      avatarUrl = brandAvatarUrl(nextId);
      fields.avatarUrl = avatarUrl;
    }
    const nextData: Record<string, unknown> = { ...current, ...fields };
    if (input.disconnectOutreach) delete nextData.unipileSyncedAt;
    await db.collection("brands").doc(nextId).set(nextData);
    await ref.delete();
  } else {
    await ref.update({
      ...fields,
      ...(input.disconnectOutreach ? { unipileSyncedAt: FieldValue.delete() } : {}),
    });
  }
  return hydrateBrandRecord({
    id: nextId,
    createdAt: asDate(current.createdAt),
    linkedinSub: current.linkedinSub,
    linkedinEmail: current.linkedinEmail,
    linkedinPublicId: current.linkedinPublicId,
    linkedinCompany: current.linkedinCompany,
    unipileSyncedAt,
    ...fields,
  });
}

export async function fetchBrand(brandId: string) {
  const db = requireFirebaseDb();
  const snapshot = await db.collection("brands").doc(brandId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  return hydrateBrandRecord({
    id: snapshot.id,
    name: String(data.name ?? ""),
    avatarColor: String(data.avatarColor ?? "#6D1472"),
    createdAt: asDate(data.createdAt),
    linkedinSub: data.linkedinSub,
    linkedinEmail: data.linkedinEmail,
    linkedinPublicId: data.linkedinPublicId,
    linkedinCompany: data.linkedinCompany,
    avatarUrl: data.avatarUrl,
    unipileAccountId: data.unipileAccountId,
    unipileStatus: data.unipileStatus,
    unipileSyncedAt: data.unipileSyncedAt,
    pacing: data.pacing,
    schedule: data.schedule,
    outreachPaused: data.outreachPaused,
    testMode: data.testMode,
    archived: data.archived,
    alerts: data.alerts,
  });
}

export async function findBrandByUnipileAccount(accountId: string) {
  const db = requireFirebaseDb();
  const snapshot = await db
    .collection("brands")
    .where("unipileAccountId", "==", accountId)
    .limit(1)
    .get();
  const item = snapshot.docs[0];
  if (!item) return null;
  const data = item.data();
  return hydrateBrandRecord({
    id: item.id,
    name: String(data.name ?? ""),
    avatarColor: String(data.avatarColor ?? "#6D1472"),
    createdAt: asDate(data.createdAt),
    linkedinSub: data.linkedinSub,
    linkedinEmail: data.linkedinEmail,
    linkedinPublicId: data.linkedinPublicId,
    linkedinCompany: data.linkedinCompany,
    avatarUrl: data.avatarUrl,
    unipileAccountId: data.unipileAccountId,
    unipileStatus: data.unipileStatus,
    unipileSyncedAt: data.unipileSyncedAt,
    pacing: data.pacing,
  });
}

export async function attachUnipileAccount(
  brandId: string,
  accountId: string,
  status: UnipileStatus = "running",
  linkedinPublicId?: string,
) {
  const db = requireFirebaseDb();
  const ref = db.collection("brands").doc(brandId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("not-found");
  const publicId = linkedinPublicId?.trim();
  await ref.update({
    unipileAccountId: accountId,
    unipileStatus: status,
    ...(status === "running" ? { unipileSyncedAt: Timestamp.now() } : {}),
    ...(publicId ? { linkedinPublicId: publicId } : {}),
  });
  const brand = await fetchBrand(brandId);
  if (!brand || status !== "running") return brand;
  return fillBrandLinkedInCompany(brand);
}

export async function setUnipileStatus(brandId: string, status: UnipileStatus) {
  await requireFirebaseDb().collection("brands").doc(brandId).update({ unipileStatus: status });
}

export async function deleteBrand(brandId: string) {
  const db = requireFirebaseDb();
  await deleteBrandAvatar(brandId);
  await deleteOutreachForBrand(db, brandId);
  await db.collection("brands").doc(brandId).delete();
}

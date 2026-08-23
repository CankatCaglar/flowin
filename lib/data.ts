import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  getSeedBrandStats,
  seedBrands,
  seedCampaigns,
  seedDailyStats,
  seedLeads,
} from "@/lib/seed";
import {
  hydrateBrandDates,
  readBrandOverlay,
  writeBrandOverlay,
} from "@/lib/storage";
import type { Brand, Campaign, DailyStat, Lead } from "@/types";

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

function mergeSeedBrands() {
  const overlay = readBrandOverlay();
  const updated = seedBrands.map((brand) => {
    const patch = overlay.updates[brand.id];
    return hydrateBrandDates({ ...brand, ...patch });
  });
  const created = overlay.created.map(hydrateBrandDates);
  const deleted = new Set(overlay.deleted ?? []);
  return [...updated, ...created].filter((brand) => !deleted.has(brand.id));
}

export async function fetchBrands(): Promise<Brand[]> {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, "brands"));
      if (!snapshot.empty) {
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: String(data.name ?? ""),
            avatarColor: String(data.avatarColor ?? "#6D1472"),
            createdAt: asDate(data.createdAt),
          };
        });
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return mergeSeedBrands();
}

export async function fetchCampaigns(brandId: string): Promise<Campaign[]> {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, "brands", brandId, "campaigns"));
      if (!snapshot.empty) {
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            brandId,
            name: String(data.name ?? ""),
            status: data.status,
            sentCount: Number(data.sentCount ?? 0),
            repliedCount: Number(data.repliedCount ?? 0),
            startDate: asDate(data.startDate),
            endDate: asDate(data.endDate),
          } as Campaign;
        });
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return seedCampaigns.filter((campaign) => campaign.brandId === brandId);
}

export async function fetchLeads(brandId: string): Promise<Lead[]> {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, "brands", brandId, "leads"));
      if (!snapshot.empty) {
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            brandId,
            campaignId: String(data.campaignId ?? ""),
            fullName: String(data.fullName ?? ""),
            linkedinUrl: String(data.linkedinUrl ?? ""),
            status: data.status,
            lastMessageSentAt: asDate(data.lastMessageSentAt),
            firstReplyReceivedAt: data.firstReplyReceivedAt
              ? asDate(data.firstReplyReceivedAt)
              : undefined,
          } as Lead;
        });
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return seedLeads.filter((lead) => lead.brandId === brandId);
}

export async function fetchDailyStats(brandId: string): Promise<DailyStat[]> {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, "brands", brandId, "daily_stats"));
      if (!snapshot.empty) {
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            date: String(data.date ?? item.id),
            sentCount: Number(data.sentCount ?? 0),
            repliedCount: Number(data.repliedCount ?? 0),
          };
        });
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return seedDailyStats[brandId] ?? [];
}

export async function createBrand(input: { name: string; avatarColor: string }) {
  const payload = {
    name: input.name.trim(),
    avatarColor: input.avatarColor,
    createdAt: new Date(),
  };

  const db = getFirebaseDb();
  if (db) {
    const ref = await addDoc(collection(db, "brands"), {
      ...payload,
      createdAt: Timestamp.fromDate(payload.createdAt),
    });
    return { id: ref.id, ...payload };
  }

  const brand: Brand = {
    id: `local-${crypto.randomUUID()}`,
    ...payload,
  };
  const overlay = readBrandOverlay();
  overlay.created.push(brand);
  writeBrandOverlay(overlay);
  return brand;
}

export async function updateBrand(
  brandId: string,
  input: { name: string; avatarColor?: string },
) {
  const db = getFirebaseDb();
  if (db) {
    await updateDoc(doc(db, "brands", brandId), {
      name: input.name.trim(),
      ...(input.avatarColor ? { avatarColor: input.avatarColor } : {}),
    });
    return;
  }

  const overlay = readBrandOverlay();
  const createdIndex = overlay.created.findIndex((brand) => brand.id === brandId);
  if (createdIndex >= 0) {
    overlay.created[createdIndex] = {
      ...overlay.created[createdIndex],
      name: input.name.trim(),
      avatarColor: input.avatarColor ?? overlay.created[createdIndex].avatarColor,
    };
  } else {
    overlay.updates[brandId] = {
      ...overlay.updates[brandId],
      name: input.name.trim(),
      ...(input.avatarColor ? { avatarColor: input.avatarColor } : {}),
    };
  }
  writeBrandOverlay(overlay);
}

export async function deleteBrand(brandId: string) {
  const db = getFirebaseDb();
  if (db) {
    await deleteDoc(doc(db, "brands", brandId));
    return;
  }

  const overlay = readBrandOverlay();
  overlay.created = overlay.created.filter((brand) => brand.id !== brandId);
  delete overlay.updates[brandId];
  overlay.deleted = [...new Set([...(overlay.deleted ?? []), brandId])];
  writeBrandOverlay(overlay);
}

export function brandCardStats(brandId: string, campaigns?: Campaign[]) {
  if (campaigns) {
    const sent = campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0);
    const replied = campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0);
    return {
      activeCampaigns: campaigns.filter(
        (campaign) => campaign.status === "active" || campaign.status === "expiring",
      ).length,
      successRate: sent > 0 ? (replied / sent) * 100 : 0,
    };
  }
  return getSeedBrandStats(brandId);
}

export { isFirebaseConfigured };

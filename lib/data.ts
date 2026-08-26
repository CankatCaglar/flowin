import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { defaultCampaignFlow } from "@/lib/campaign-flow";
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
  hydrateCampaignDates,
  readBrandOverlay,
  readCampaignOverlay,
  readLeadOverlay,
  writeBrandOverlay,
  writeCampaignOverlay,
  writeLeadOverlay,
} from "@/lib/storage";
import type {
  Brand,
  Campaign,
  CampaignFlowStep,
  CampaignStatus,
  DailyStat,
  FlowDelayUnit,
  Lead,
  LeadStage,
} from "@/types";

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

function stageFromStatus(status: Lead["status"]): LeadStage {
  if (status === "replied") return "replied";
  if (status === "in_progress") return "first_contact";
  return "awaiting_reply";
}

function hydrateCampaign(input: Partial<Campaign> & Pick<Campaign, "id" | "brandId" | "name">): Campaign {
  const startDate = asDate(input.startDate);
  const stored = Array.isArray(input.flow) ? input.flow : [];
  // Flows saved before the accept / no-response split have no branch data.
  const branched = stored.some((step) => Boolean(step.branch));
  const flow = (branched ? stored : defaultCampaignFlow()).map((step) => ({
    ...step,
    delayDays: Number(step.delayDays ?? 0),
    delayUnit: (step.delayUnit === "hours" ? "hours" : "days") as FlowDelayUnit,
    premium: Boolean(step.premium),
  }));
  return hydrateCampaignDates({
    id: input.id,
    brandId: input.brandId,
    name: input.name,
    status: (input.status as CampaignStatus) ?? "draft",
    sentCount: Number(input.sentCount ?? 0),
    repliedCount: Number(input.repliedCount ?? 0),
    startDate,
    endDate: asDate(input.endDate ?? startDate),
    createdAt: asDate(input.createdAt ?? startDate),
    targetAudience: String(input.targetAudience ?? input.name),
    leadGoal: Number(input.leadGoal ?? input.sentCount ?? 0),
    flow,
  });
}

function hydrateLead(input: Partial<Lead> & Pick<Lead, "id" | "brandId" | "campaignId" | "fullName">): Lead {
  const status = input.status ?? "in_progress";
  const slug = input.fullName.toLowerCase().replace(/\s+/g, ".");
  return {
    id: input.id,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName,
    linkedinUrl: String(input.linkedinUrl ?? ""),
    status,
    lastMessageSentAt: asDate(input.lastMessageSentAt),
    firstReplyReceivedAt: input.firstReplyReceivedAt
      ? asDate(input.firstReplyReceivedAt)
      : undefined,
    company: String(input.company ?? "—"),
    position: String(input.position ?? "—"),
    stage: input.stage ?? stageFromStatus(status),
    email: String(input.email ?? `${slug}@example.com`),
    phone: String(input.phone ?? ""),
  };
}

function mergeCampaigns(brandId: string, base: Campaign[]): Campaign[] {
  const overlay = readCampaignOverlay();
  const deleted = new Set(overlay.deleted ?? []);
  const updated = base.map((campaign) => {
    const patch = overlay.updates[campaign.id];
    return hydrateCampaign({ ...campaign, ...patch, id: campaign.id, brandId: campaign.brandId });
  });
  const created = overlay.created
    .filter((campaign) => campaign.brandId === brandId)
    .map((campaign) => hydrateCampaign(campaign));
  return [...updated, ...created].filter(
    (campaign) => !deleted.has(campaign.id) && campaign.brandId === brandId,
  );
}

function mergeLeads(brandId: string, base: Lead[]): Lead[] {
  const overlay = readLeadOverlay();
  const created = overlay.created
    .filter((lead) => lead.brandId === brandId)
    .map((lead) =>
      hydrateLead({
        ...lead,
        id: lead.id,
        brandId: lead.brandId,
        campaignId: lead.campaignId,
        fullName: lead.fullName,
      }),
    );
  return [...base.map((lead) => hydrateLead(lead)), ...created];
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
        const fromDb = snapshot.docs.map((item) => {
          const data = item.data();
          return hydrateCampaign({
            id: item.id,
            brandId,
            name: String(data.name ?? ""),
            status: data.status,
            sentCount: Number(data.sentCount ?? 0),
            repliedCount: Number(data.repliedCount ?? 0),
            startDate: asDate(data.startDate),
            endDate: asDate(data.endDate),
            createdAt: data.createdAt ? asDate(data.createdAt) : asDate(data.startDate),
            targetAudience: data.targetAudience,
            leadGoal: data.leadGoal,
            flow: data.flow,
          });
        });
        return mergeCampaigns(brandId, fromDb);
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return mergeCampaigns(
    brandId,
    seedCampaigns.filter((campaign) => campaign.brandId === brandId),
  );
}

export async function fetchLeads(brandId: string): Promise<Lead[]> {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, "brands", brandId, "leads"));
      if (!snapshot.empty) {
        const fromDb = snapshot.docs.map((item) => {
          const data = item.data();
          return hydrateLead({
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
            company: data.company,
            position: data.position,
            stage: data.stage,
            email: data.email,
            phone: data.phone,
          });
        });
        return mergeLeads(brandId, fromDb);
      }
    } catch {
      // Fall through to seed data when Firestore is unavailable.
    }
  }
  return mergeLeads(
    brandId,
    seedLeads.filter((lead) => lead.brandId === brandId),
  );
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

export async function createCampaign(input: {
  brandId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  targetAudience: string;
  leadGoal: number;
  flow: CampaignFlowStep[];
  status?: CampaignStatus;
}) {
  const payload: Campaign = {
    id: `local-${crypto.randomUUID()}`,
    brandId: input.brandId,
    name: input.name.trim(),
    status: input.status ?? "draft",
    sentCount: 0,
    repliedCount: 0,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: new Date(),
    targetAudience: input.targetAudience.trim() || input.name.trim(),
    leadGoal: input.leadGoal,
    flow: input.flow,
  };

  const overlay = readCampaignOverlay();
  overlay.created.push(payload);
  writeCampaignOverlay(overlay);
  return payload;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, "name" | "flow" | "status" | "targetAudience" | "leadGoal">>,
) {
  const overlay = readCampaignOverlay();
  const createdIndex = overlay.created.findIndex((campaign) => campaign.id === campaignId);
  if (createdIndex >= 0) {
    overlay.created[createdIndex] = { ...overlay.created[createdIndex], ...patch };
  } else {
    overlay.updates[campaignId] = { ...overlay.updates[campaignId], ...patch };
  }
  writeCampaignOverlay(overlay);
}

function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export async function createLead(input: {
  brandId: string;
  campaignId: string;
  fullName: string;
  linkedinUrl: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
}) {
  const payload: Lead = {
    id: `local-lead-${crypto.randomUUID()}`,
    brandId: input.brandId,
    campaignId: input.campaignId,
    fullName: input.fullName.trim(),
    linkedinUrl: normalizeLinkedInUrl(input.linkedinUrl),
    status: "in_progress",
    lastMessageSentAt: new Date(),
    company: input.company?.trim() || "—",
    position: input.position?.trim() || "—",
    stage: "first_contact",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
  };
  const overlay = readLeadOverlay();
  overlay.created.push(payload);
  writeLeadOverlay(overlay);
  return payload;
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

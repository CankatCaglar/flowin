import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { brandSlug, looksLikeAutoId } from "@/lib/brand-id";
import { requireFirebaseDb } from "@/lib/firebase";
import { hydrateBrandDates } from "@/lib/storage";
import type { Brand } from "@/types";

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
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
    avatarUrl: String(input.avatarUrl ?? ""),
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
    await db.collection("brands").doc(nextId).set(data);
    await item.ref.delete();
  }
}

export async function fetchBrands(): Promise<Brand[]> {
  const db = requireFirebaseDb();
  await migrateReadableBrandIds(db);
  const snapshot = await db.collection("brands").get();
  return snapshot.docs.map((item) => {
    const data = item.data();
    return hydrateBrandRecord({
      id: item.id,
      name: String(data.name ?? ""),
      avatarColor: String(data.avatarColor ?? "#6D1472"),
      createdAt: asDate(data.createdAt),
      linkedinSub: data.linkedinSub,
      linkedinEmail: data.linkedinEmail,
      avatarUrl: data.avatarUrl,
    });
  });
}

export async function createBrand(input: {
  name: string;
  avatarColor: string;
  linkedinSub: string;
  linkedinEmail?: string;
  avatarUrl?: string;
}) {
  const db = requireFirebaseDb();
  const linkedinSub = input.linkedinSub.trim();
  if (await findBrandByLinkedInSub(db, linkedinSub)) {
    throw new Error("already-connected");
  }
  const payload = {
    name: input.name.trim(),
    avatarColor: input.avatarColor,
    createdAt: new Date(),
    linkedinSub,
    linkedinEmail: input.linkedinEmail?.trim() ?? "",
    avatarUrl: input.avatarUrl?.trim() ?? "",
  };
  const id = await uniqueBrandId(db, payload.name);
  await db.collection("brands").doc(id).create({
    ...payload,
    createdAt: Timestamp.fromDate(payload.createdAt),
  });
  return { id, ...payload };
}

export async function updateBrand(
  brandId: string,
  input: { name: string; avatarColor?: string },
) {
  const db = requireFirebaseDb();
  const ref = db.collection("brands").doc(brandId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("not-found");
  }
  const current = snapshot.data() ?? {};
  const name = input.name.trim();
  const avatarColor = input.avatarColor ?? String(current.avatarColor ?? "#6D1472");
  const nextId = await uniqueBrandId(db, name, brandId);
  const next = {
    ...current,
    name,
    avatarColor,
  };
  if (nextId !== brandId) {
    await db.collection("brands").doc(nextId).set(next);
    await ref.delete();
  } else {
    await ref.update({ name, avatarColor });
  }
  return hydrateBrandRecord({
    id: nextId,
    name,
    avatarColor,
    createdAt: asDate(current.createdAt),
    linkedinSub: current.linkedinSub,
    linkedinEmail: current.linkedinEmail,
    avatarUrl: current.avatarUrl,
  });
}

export async function deleteBrand(brandId: string) {
  await requireFirebaseDb().collection("brands").doc(brandId).delete();
}

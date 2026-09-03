import "server-only";
import { getFirebaseStorage } from "@/lib/firebase";

const MAX_BYTES = 2_000_000;
const STORAGE_CACHE = "private, max-age=86400";
const memory = new Map<string, AvatarImage>();

export const AVATAR_CACHE_CONTROL = "private, max-age=86400, stale-while-revalidate=604800";

export type AvatarImage = {
  buffer: Buffer;
  contentType: string;
};

export function brandAvatarPath(brandId: string) {
  return `brand-avatars/${safeSegment(brandId)}`;
}

export function leadAvatarPath(leadId: string) {
  return `lead-avatars/${safeSegment(leadId)}`;
}

export function pendingAvatarPath(linkedinSub: string) {
  return `brand-avatars/pending/${safeSegment(linkedinSub)}`;
}

export function brandAvatarUrl(brandId: string, version?: number) {
  const path = `/api/brands/${encodeURIComponent(brandId)}/avatar`;
  return version ? `${path}?v=${version}` : path;
}

export function leadAvatarUrl(leadId: string, version?: number) {
  const path = `/api/leads/${encodeURIComponent(leadId)}/avatar`;
  return version ? `${path}?v=${version}` : path;
}

export function isStoredAvatarUrl(url: string) {
  const path = url.split("?")[0] ?? url;
  return path.startsWith("/api/brands/") && path.endsWith("/avatar");
}

export function isStoredLeadAvatarUrl(url: string) {
  const path = url.split("?")[0] ?? url;
  return path.startsWith("/api/leads/") && path.endsWith("/avatar");
}

export const MISSING_LEAD_AVATAR = "none";

export function isMissingLeadAvatar(url: string) {
  return url.trim() === MISSING_LEAD_AVATAR;
}

export function isRemoteAvatarUrl(url: string) {
  return /^https?:\/\//i.test(url) && !isStoredAvatarUrl(url) && !isStoredLeadAvatarUrl(url);
}

export async function downloadRemoteImage(url: string): Promise<AvatarImage | null> {
  for (const candidate of pictureCandidates(url)) {
    const image = await fetchImage(candidate);
    if (image) return image;
  }
  return null;
}

export async function saveBrandAvatar(brandId: string, image: AvatarImage) {
  return writeAvatar(brandAvatarPath(brandId), image);
}

export async function saveLeadAvatar(leadId: string, image: AvatarImage) {
  return writeAvatar(leadAvatarPath(leadId), image);
}

export async function savePendingAvatar(linkedinSub: string, image: AvatarImage) {
  const file = await storageFile(pendingAvatarPath(linkedinSub));
  if (!file) return false;
  await file.save(image.buffer, {
    resumable: false,
    metadata: {
      contentType: image.contentType,
      cacheControl: "private, max-age=600",
    },
  });
  return true;
}

export async function storePendingLinkedInAvatar(linkedinSub: string, pictureUrl: string) {
  const image = await downloadRemoteImage(pictureUrl);
  if (!image) return false;
  try {
    return await savePendingAvatar(linkedinSub, image);
  } catch (error) {
    console.error(
      "[brand-avatar] pending upload failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}

export async function promotePendingAvatar(linkedinSub: string, brandId: string) {
  const bucket = await getFirebaseStorage();
  if (!bucket) return false;
  const pending = bucket.file(pendingAvatarPath(linkedinSub));
  try {
    const [exists] = await pending.exists();
    if (!exists) return false;
    await pending.copy(bucket.file(brandAvatarPath(brandId)));
    await pending.delete({ ignoreNotFound: true });
    forget(brandAvatarPath(brandId));
    return true;
  } catch (error) {
    console.error(
      "[brand-avatar] promote failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}

export async function ingestBrandAvatar(input: {
  brandId: string;
  linkedinSub?: string;
  remoteUrl?: string;
}) {
  try {
    if (input.remoteUrl && isRemoteAvatarUrl(input.remoteUrl)) {
      const image = await downloadRemoteImage(input.remoteUrl);
      if (image && (await saveBrandAvatar(input.brandId, image))) {
        return brandAvatarUrl(input.brandId, Date.now());
      }
    }
    if (input.linkedinSub && (await promotePendingAvatar(input.linkedinSub, input.brandId))) {
      return brandAvatarUrl(input.brandId, Date.now());
    }
  } catch (error) {
    console.error(
      "[brand-avatar] ingest failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return "";
}

export async function moveBrandAvatar(fromId: string, toId: string) {
  if (fromId === toId) return;
  const bucket = await getFirebaseStorage();
  if (!bucket) return;
  const from = bucket.file(brandAvatarPath(fromId));
  try {
    const [exists] = await from.exists();
    if (!exists) return;
    await from.copy(bucket.file(brandAvatarPath(toId)));
    await from.delete({ ignoreNotFound: true });
    forget(brandAvatarPath(fromId));
    forget(brandAvatarPath(toId));
  } catch (error) {
    console.error(
      "[brand-avatar] move failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export async function deleteBrandAvatar(brandId: string) {
  await deleteAvatar(brandAvatarPath(brandId), "brand-avatar");
}

export async function deleteLeadAvatar(leadId: string) {
  await deleteAvatar(leadAvatarPath(leadId), "lead-avatar");
}

export async function copyLeadAvatar(fromId: string, toId: string) {
  if (fromId === toId) return false;
  const bucket = await getFirebaseStorage();
  if (!bucket) return false;
  const from = bucket.file(leadAvatarPath(fromId));
  try {
    const [exists] = await from.exists();
    if (!exists) return false;
    await from.copy(bucket.file(leadAvatarPath(toId)));
    forget(leadAvatarPath(toId));
    return true;
  } catch (error) {
    console.error(
      "[lead-avatar] copy failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}

export async function ingestLeadAvatar(input: { leadId: string; remoteUrl?: string }) {
  const image = await downloadLeadAvatarImage(input.leadId, input.remoteUrl);
  return image ? leadAvatarUrl(input.leadId) : "";
}

export async function downloadLeadAvatarImage(
  leadId: string,
  remoteUrl?: string,
): Promise<AvatarImage | null> {
  if (!remoteUrl || !isRemoteAvatarUrl(remoteUrl)) return null;
  try {
    const image = await downloadRemoteImage(remoteUrl);
    if (!image) return null;
    await saveLeadAvatar(leadId, image);
    return image;
  } catch (error) {
    console.error(
      "[lead-avatar] ingest failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

export async function readBrandAvatar(brandId: string): Promise<AvatarImage | null> {
  return readAvatar(brandAvatarPath(brandId), "brand-avatar");
}

export async function readLeadAvatar(leadId: string): Promise<AvatarImage | null> {
  return readAvatar(leadAvatarPath(leadId), "lead-avatar");
}

export function avatarResponseHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": AVATAR_CACHE_CONTROL,
  };
}

function forget(path: string) {
  memory.delete(path);
}

async function writeAvatar(path: string, image: AvatarImage) {
  const file = await storageFile(path);
  if (!file) return false;
  await file.save(image.buffer, {
    resumable: false,
    metadata: {
      contentType: image.contentType,
      cacheControl: STORAGE_CACHE,
    },
  });
  memory.set(path, image);
  return true;
}

async function readAvatar(path: string, label: string): Promise<AvatarImage | null> {
  const cached = memory.get(path);
  if (cached) return cached;
  const file = await storageFile(path);
  if (!file) return null;
  try {
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType =
      sniffImageType(buffer) ??
      normalizeImageType(typeof metadata.contentType === "string" ? metadata.contentType : null) ??
      "image/jpeg";
    const image = { buffer, contentType };
    memory.set(path, image);
    return image;
  } catch (error) {
    console.error(`[${label}] read failed:`, error instanceof Error ? error.message : "unknown");
    return null;
  }
}

async function deleteAvatar(path: string, label: string) {
  forget(path);
  const file = await storageFile(path);
  if (!file) return;
  try {
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    console.error(`[${label}] delete failed:`, error instanceof Error ? error.message : "unknown");
  }
}

async function fetchImage(url: string): Promise<AvatarImage | null> {
  if (!isRemoteAvatarUrl(url)) return null;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      console.error("[brand-avatar] download failed:", response.status);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 32 || buffer.length > MAX_BYTES) return null;
    const contentType =
      sniffImageType(buffer) ??
      normalizeImageType(response.headers.get("content-type"));
    if (!contentType) return null;
    return { buffer, contentType };
  } catch (error) {
    console.error(
      "[brand-avatar] download error:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

function pictureCandidates(url: string) {
  if (!isRemoteAvatarUrl(url)) return [];
  const larger = url
    .replace(/profile-displayphoto-shrink_\d+_\d+/g, "profile-displayphoto-shrink_800_800")
    .replace(/profile-framedphoto-shrink_\d+_\d+/g, "profile-framedphoto-shrink_800_800");
  return larger === url ? [url] : [larger, url];
}

async function storageFile(path: string) {
  const bucket = await getFirebaseStorage();
  return bucket ? bucket.file(path) : null;
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128) || "brand";
}

function normalizeImageType(value: string | null) {
  const type = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/png" || type === "image/webp" || type === "image/gif") return type;
  return null;
}

function sniffImageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

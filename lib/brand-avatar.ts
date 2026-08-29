import "server-only";
import { getFirebaseStorage } from "@/lib/firebase";

const MAX_BYTES = 2_000_000;

export type AvatarImage = {
  buffer: Buffer;
  contentType: string;
};

export function brandAvatarPath(brandId: string) {
  return `brand-avatars/${safeSegment(brandId)}`;
}

export function pendingAvatarPath(linkedinSub: string) {
  return `brand-avatars/pending/${safeSegment(linkedinSub)}`;
}

export function brandAvatarUrl(brandId: string, version = Date.now()) {
  return `/api/brands/${encodeURIComponent(brandId)}/avatar?v=${version}`;
}

export function isStoredAvatarUrl(url: string) {
  const path = url.split("?")[0] ?? url;
  return path.startsWith("/api/brands/") && path.endsWith("/avatar");
}

export function isRemoteAvatarUrl(url: string) {
  return /^https?:\/\//i.test(url) && !isStoredAvatarUrl(url);
}

export async function downloadRemoteImage(url: string): Promise<AvatarImage | null> {
  for (const candidate of pictureCandidates(url)) {
    const image = await fetchImage(candidate);
    if (image) return image;
  }
  return null;
}

export async function saveBrandAvatar(brandId: string, image: AvatarImage) {
  const file = await storageFile(brandAvatarPath(brandId));
  if (!file) return false;
  await file.save(image.buffer, {
    resumable: false,
    metadata: {
      contentType: image.contentType,
      cacheControl: "private, no-cache",
    },
  });
  return true;
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
        return brandAvatarUrl(input.brandId);
      }
    }
    if (input.linkedinSub && (await promotePendingAvatar(input.linkedinSub, input.brandId))) {
      return brandAvatarUrl(input.brandId);
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
  } catch (error) {
    console.error(
      "[brand-avatar] move failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export async function deleteBrandAvatar(brandId: string) {
  const file = await storageFile(brandAvatarPath(brandId));
  if (!file) return;
  try {
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    console.error(
      "[brand-avatar] delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export async function readBrandAvatar(brandId: string): Promise<AvatarImage | null> {
  const file = await storageFile(brandAvatarPath(brandId));
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
    return { buffer, contentType };
  } catch (error) {
    console.error(
      "[brand-avatar] read failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
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

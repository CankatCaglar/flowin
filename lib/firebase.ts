import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
}

export function storageBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    (process.env.FIREBASE_PROJECT_ID
      ? `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
      : "")
  );
}

export function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      privateKey(),
  );
}

let app: App | null = null;
let db: Firestore | null = null;
let storageBucket: Bucket | null | undefined;

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey(),
        }),
        storageBucket: storageBucketName() || undefined,
      });
  }
  return app;
}

export async function getFirebaseStorage() {
  if (storageBucket !== undefined) return storageBucket;
  if (!isFirebaseConfigured()) {
    storageBucket = null;
    return null;
  }
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    storageBucket = null;
    return null;
  }
  const storage = getStorage(firebaseApp);
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET?.trim(),
    projectId ? `${projectId}.firebasestorage.app` : "",
    projectId ? `${projectId}-avatars` : "",
    projectId ? `${projectId}.appspot.com` : "",
  ].filter((name, index, list): name is string => Boolean(name) && list.indexOf(name) === index);

  for (const name of candidates) {
    const bucket = storage.bucket(name);
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        storageBucket = bucket;
        return bucket;
      }
    } catch (error) {
      console.error(
        "[firebase] storage bucket check failed:",
        name,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  storageBucket = null;
  return null;
}

export function getFirebaseDb() {
  if (!isFirebaseConfigured()) return null;
  if (!db) {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return null;
    db = getFirestore(firebaseApp);
  }
  return db;
}

export function requireFirebaseDb() {
  const next = getFirebaseDb();
  if (!next) {
    throw new Error("firebase-unconfigured");
  }
  return next;
}

export function firebaseStatus(error: unknown) {
  return error instanceof Error && error.message === "firebase-unconfigured" ? 503 : 500;
}

export function firebasePayload(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  const message = error instanceof Error ? error.message : "firebase";
  console.error("[firebase]", code ?? "", message);
  return { error: "firebase" as const, code, message };
}

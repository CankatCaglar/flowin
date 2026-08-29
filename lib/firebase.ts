import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
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
      });
  }
  return app;
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

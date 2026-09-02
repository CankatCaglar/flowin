import "server-only";
import { brandSlug } from "@/lib/brand-id";
import { attachUnipileAccount, requireBrandDocs, setUnipileStatus } from "@/lib/data";
import {
  isUnipileConfigured,
  listUnipileAccounts,
  unipileAccountPublicId,
  type UnipileAccount,
} from "@/lib/unipile";

function isLinkedInAccount(account: UnipileAccount) {
  const type = String(account.type ?? "").toUpperCase();
  return !type || type.includes("LINKEDIN");
}

function isRunning(account: UnipileAccount) {
  const status = String(account.status ?? "").toLowerCase();
  if (status === "running" || status === "ok" || status === "creation_success") return true;
  const sources = account.sources ?? [];
  if (
    sources.some((source) => {
      const value = String(source.status ?? "").toUpperCase();
      return value === "OK" || value === "RUNNING";
    })
  ) {
    return true;
  }
  return !status && sources.length === 0;
}

function namesMatch(account: UnipileAccount, brandId: string, brandName: string) {
  const accountName = String(account.name ?? "").trim();
  if (!accountName) return false;
  if (accountName === brandId) return true;
  if (accountName.toLocaleLowerCase("tr") === brandName.trim().toLocaleLowerCase("tr")) {
    return true;
  }
  return brandSlug(accountName) === brandId;
}

function emailsMatch(account: UnipileAccount, email: string) {
  if (!email) return false;
  const username = String(account.connection_params?.im?.username ?? "").toLowerCase();
  return username === email.trim().toLowerCase();
}

export async function resolveBrandUnipileAccount(input: {
  id: string;
  name: string;
  linkedinEmail?: string;
  unipileAccountId?: string;
  skipIds?: string[];
}) {
  if (!isUnipileConfigured()) return "";
  const skip = new Set((input.skipIds ?? []).filter(Boolean));
  const accounts = await listedAccounts();
  const seats = accounts.filter((account) => isLinkedInAccount(account) && isRunning(account));
  const attached = input.unipileAccountId?.trim() ?? "";
  if (attached && !skip.has(attached)) {
    const seat = accounts.find((account) => account.id === attached);
    if (seat && isLinkedInAccount(seat) && isRunning(seat)) return attached;
  }
  const match =
    seats.find(
      (account) => !skip.has(account.id) && namesMatch(account, input.id, input.name),
    ) ??
    seats.find(
      (account) => !skip.has(account.id) && emailsMatch(account, input.linkedinEmail ?? ""),
    ) ??
    (seats.filter((account) => !skip.has(account.id)).length === 1
      ? seats.find((account) => !skip.has(account.id))
      : undefined);
  if (!match?.id) return "";
  if (match.id !== attached) {
    await attachUnipileAccount(input.id, match.id, "running", unipileAccountPublicId(match) || undefined);
  }
  return match.id;
}

let accountsCache: { at: number; items: UnipileAccount[] } | null = null;

async function listedAccounts() {
  if (accountsCache && Date.now() - accountsCache.at < 20_000) return accountsCache.items;
  const items = await listUnipileAccounts();
  accountsCache = { at: Date.now(), items };
  return items;
}

export async function syncUnipileSeats() {
  if (!isUnipileConfigured()) return;
  const [docs, accounts] = await Promise.all([requireBrandDocs(), listedAccounts()]);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const used = new Set<string>();
  const seats = accounts.filter((account) => isLinkedInAccount(account) && isRunning(account));

  for (const item of docs) {
    const data = item.data();
    const attached = String(data.unipileAccountId ?? "").trim();
    if (!attached) continue;
    const seat = byId.get(attached);
    if (seat && isLinkedInAccount(seat) && isRunning(seat)) {
      used.add(attached);
      const publicId = unipileAccountPublicId(seat);
      if (data.unipileStatus !== "running" || (publicId && publicId !== String(data.linkedinPublicId ?? ""))) {
        await attachUnipileAccount(item.id, attached, "running", publicId || undefined);
      }
      continue;
    }
    if (data.unipileStatus === "running" || data.unipileStatus === "none") {
      await setUnipileStatus(item.id, "disconnected");
    }
  }

  for (const item of docs) {
    const data = item.data();
    const attached = String(data.unipileAccountId ?? "").trim();
    if (attached && used.has(attached) && data.unipileStatus === "running") {
      continue;
    }
    const brandName = String(data.name ?? "");
    const email = String(data.linkedinEmail ?? "");
    const match =
      seats.find((account) => !used.has(account.id) && namesMatch(account, item.id, brandName)) ??
      seats.find((account) => !used.has(account.id) && emailsMatch(account, email));
    if (!match?.id) continue;
    await attachUnipileAccount(item.id, match.id, "running", unipileAccountPublicId(match) || undefined);
    used.add(match.id);
  }
}

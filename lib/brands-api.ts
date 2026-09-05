import { hydrateBrandDates } from "@/lib/storage";
import type { Brand } from "@/types";

async function request(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error("network");
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error("unauthorized");
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "request-failed";
    throw new Error(error);
  }
  return data as T;
}

export async function fetchBrands(): Promise<Brand[]> {
  const response = await request("/api/brands");
  const rows = await readJson<Brand[]>(response);
  return rows.map(hydrateBrandDates);
}

export async function createBrand(input: {
  name: string;
  avatarColor: string;
  linkedinSub: string;
  linkedinEmail?: string;
  avatarUrl?: string;
}): Promise<Brand> {
  const response = await request("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return hydrateBrandDates(await readJson<Brand>(response));
}

export async function updateBrand(
  brandId: string,
  input: {
    name?: string;
    avatarColor?: string;
    linkedinCompany?: string | null;
    linkedinPublicId?: string;
    pacing?: {
      dailyInvites: number;
      dailyMessages: number;
      dailyViews: number;
      dailyInmails: number;
    };
    schedule?: { startHour: number; endHour: number; weekdays: number[] };
    outreachPaused?: boolean;
    testMode?: boolean;
    archived?: boolean;
    alerts?: {
      connectionLost: boolean;
      sendFailed: boolean;
      lowLeads: boolean;
      dailyCap: boolean;
    };
    disconnectOutreach?: boolean;
  },
) {
  const response = await request(`/api/brands/${encodeURIComponent(brandId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return hydrateBrandDates(await readJson<Brand>(response));
}

export async function deleteBrand(brandId: string) {
  const response = await request(`/api/brands/${encodeURIComponent(brandId)}`, {
    method: "DELETE",
  });
  await readJson<{ ok: true }>(response);
}

import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { fetchDailyStats } from "@/lib/outreach-data";

export async function GET(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId")?.trim() ?? "";
  const campaignId = url.searchParams.get("campaignId")?.trim() ?? "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json(await fetchDailyStats(brandId, campaignId || undefined));
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

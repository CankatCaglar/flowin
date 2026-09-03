import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { hydrateLeadAvatars } from "@/lib/lead-avatar";
import { fetchLeads } from "@/lib/outreach-data";

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { brandId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const brandId = typeof body.brandId === "string" ? body.brandId.trim() : "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const leads = await fetchLeads(brandId);
    return NextResponse.json(await hydrateLeadAvatars(leads));
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { createLead, fetchLeads } from "@/lib/outreach-data";

export async function GET(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() ?? "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json(await fetchLeads(brandId));
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    brandId?: unknown;
    campaignId?: unknown;
    fullName?: unknown;
    linkedinUrl?: unknown;
    company?: unknown;
    position?: unknown;
    email?: unknown;
    phone?: unknown;
    unipileProviderId?: unknown;
    pictureUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (
    typeof body.brandId !== "string" ||
    typeof body.campaignId !== "string" ||
    typeof body.fullName !== "string" ||
    typeof body.linkedinUrl !== "string"
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const lead = await createLead({
      brandId: body.brandId,
      campaignId: body.campaignId,
      fullName: body.fullName,
      linkedinUrl: body.linkedinUrl,
      company: typeof body.company === "string" ? body.company : "",
      position: typeof body.position === "string" ? body.position : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      unipileProviderId: typeof body.unipileProviderId === "string" ? body.unipileProviderId : "",
      pictureUrl: typeof body.pictureUrl === "string" ? body.pictureUrl : "",
    });
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

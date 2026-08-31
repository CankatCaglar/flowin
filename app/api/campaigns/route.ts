import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import {
  copyCampaignLeads,
  createCampaign,
  createLeads,
  fetchCampaigns,
} from "@/lib/outreach-data";
import type { CampaignFlowStep, CampaignStatus } from "@/types";

export async function GET(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() ?? "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json(await fetchCampaigns(brandId));
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
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    targetAudience?: unknown;
    leadGoal?: unknown;
    flow?: unknown;
    status?: unknown;
    copyFromCampaignId?: unknown;
    leads?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body.brandId !== "string" || typeof body.name !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const createdAt = new Date();
    const campaign = await createCampaign({
      brandId: body.brandId,
      name: body.name,
      startDate: typeof body.startDate === "string" ? new Date(body.startDate) : createdAt,
      endDate: typeof body.endDate === "string" ? new Date(body.endDate) : createdAt,
      targetAudience: typeof body.targetAudience === "string" ? body.targetAudience : body.name,
      leadGoal: Number(body.leadGoal ?? 0),
      flow: Array.isArray(body.flow) ? (body.flow as CampaignFlowStep[]) : [],
      status: (body.status as CampaignStatus | undefined) ?? "draft",
    });
    if (typeof body.copyFromCampaignId === "string" && body.copyFromCampaignId) {
      await copyCampaignLeads(body.brandId, body.copyFromCampaignId, campaign.id);
    } else if (Array.isArray(body.leads)) {
      await createLeads(
        body.brandId,
        campaign.id,
        body.leads.filter(
          (item): item is {
            fullName: string;
            linkedinUrl: string;
            company?: string;
            position?: string;
            email?: string;
            phone?: string;
            unipileProviderId?: string;
            pictureUrl?: string;
          } =>
            Boolean(item && typeof item === "object" && "fullName" in item && "linkedinUrl" in item),
        ),
      );
    }
    return NextResponse.json(campaign);
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import {
  copyCampaignLeads,
  createCampaign,
  createLeads,
  fetchCampaigns,
  updateCampaign,
} from "@/lib/outreach-data";
import type { CampaignFlowStep, CampaignStatus } from "@/types";

function uniqueNames(rows: Array<{ campaignName: string }>) {
  return [...new Set(rows.map((row) => row.campaignName).filter(Boolean))];
}

async function applySkippedLeadGoal(campaignId: string, leadGoal: number) {
  await updateCampaign(campaignId, { leadGoal });
}

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
      const copied = await copyCampaignLeads(body.brandId, body.copyFromCampaignId, campaign.id);
      await applySkippedLeadGoal(campaign.id, copied.created.length);
      return NextResponse.json({
        ...campaign,
        leadGoal: copied.created.length,
        skippedDuplicates: copied.skipped.length,
        skippedCampaigns: uniqueNames(copied.skipped),
      });
    }
    if (Array.isArray(body.leads)) {
      const imported = await createLeads(
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
      await applySkippedLeadGoal(campaign.id, imported.created.length);
      return NextResponse.json({
        ...campaign,
        leadGoal: imported.created.length,
        skippedDuplicates: imported.skipped.length,
        skippedCampaigns: uniqueNames(imported.skipped),
      });
    }
    return NextResponse.json({ ...campaign, skippedDuplicates: 0, skippedCampaigns: [] });
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

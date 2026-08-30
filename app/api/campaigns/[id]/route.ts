import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { CAMPAIGN_STATUSES } from "@/lib/campaign-status";
import { fetchCampaign, updateCampaign } from "@/lib/outreach-data";
import type { CampaignFlowStep, CampaignStatus } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const campaign = await fetchCampaign(id);
    if (!campaign) return NextResponse.json({ error: "not-found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: {
    name?: unknown;
    flow?: unknown;
    status?: unknown;
    targetAudience?: unknown;
    leadGoal?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (
    typeof body.status === "string" &&
    !CAMPAIGN_STATUSES.includes(body.status as (typeof CAMPAIGN_STATUSES)[number])
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const patch: {
      name?: string;
      flow?: CampaignFlowStep[];
      status?: CampaignStatus;
      targetAudience?: string;
      leadGoal?: number;
    } = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (Array.isArray(body.flow)) patch.flow = body.flow as CampaignFlowStep[];
    if (typeof body.status === "string") patch.status = body.status as CampaignStatus;
    if (typeof body.targetAudience === "string") patch.targetAudience = body.targetAudience;
    if (typeof body.leadGoal === "number") patch.leadGoal = body.leadGoal;
    const campaign = await updateCampaign(id, patch);
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

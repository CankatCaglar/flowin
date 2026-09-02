import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { deleteBrand, updateBrand } from "@/lib/data";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";

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
    avatarColor?: unknown;
    pacing?: {
      dailyInvites?: unknown;
      dailyMessages?: unknown;
      dailyViews?: unknown;
      dailyInmails?: unknown;
    };
    schedule?: { startHour?: unknown; endHour?: unknown; weekdays?: unknown };
    outreachPaused?: unknown;
    testMode?: unknown;
    archived?: unknown;
    alerts?: {
      connectionLost?: unknown;
      sendFailed?: unknown;
      lowLeads?: unknown;
      dailyCap?: unknown;
    };
    disconnectOutreach?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (body.name !== undefined && typeof body.name !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const brand = await updateBrand(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      avatarColor: typeof body.avatarColor === "string" ? body.avatarColor : undefined,
      pacing: body.pacing
        ? {
            dailyInvites: Number(body.pacing.dailyInvites),
            dailyMessages: Number(body.pacing.dailyMessages),
            dailyViews: Number(body.pacing.dailyViews),
            dailyInmails: Number(body.pacing.dailyInmails),
          }
        : undefined,
      schedule: body.schedule
        ? {
            startHour: Number(body.schedule.startHour),
            endHour: Number(body.schedule.endHour),
            weekdays: Array.isArray(body.schedule.weekdays)
              ? body.schedule.weekdays.map(Number)
              : [],
          }
        : undefined,
      outreachPaused: typeof body.outreachPaused === "boolean" ? body.outreachPaused : undefined,
      testMode: typeof body.testMode === "boolean" ? body.testMode : undefined,
      archived: typeof body.archived === "boolean" ? body.archived : undefined,
      alerts: body.alerts
        ? {
            connectionLost: body.alerts.connectionLost !== false,
            sendFailed: body.alerts.sendFailed !== false,
            lowLeads: body.alerts.lowLeads !== false,
            dailyCap: body.alerts.dailyCap !== false,
          }
        : undefined,
      disconnectOutreach: body.disconnectOutreach === true,
    });
    return NextResponse.json(brand);
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteBrand(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

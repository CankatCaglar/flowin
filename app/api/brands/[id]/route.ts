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
    pacing?: { dailyInvites?: unknown; dailyMessages?: unknown; dailyViews?: unknown };
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
          }
        : undefined,
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

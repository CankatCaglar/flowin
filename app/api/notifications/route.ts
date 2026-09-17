import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { fetchNotifications, markNotificationsRead } from "@/lib/notifications";

export async function GET(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() ?? "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const items = await fetchNotifications(brandId);
    const unreadCount = items.filter((item) => !item.readAt).length;
    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function PATCH(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { brandId?: unknown; id?: unknown; all?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body.brandId !== "string" || !body.brandId.trim()) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    await markNotificationsRead({
      brandId: body.brandId.trim(),
      id: typeof body.id === "string" ? body.id : undefined,
      all: body.all === true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

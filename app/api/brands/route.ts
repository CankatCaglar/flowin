import { NextResponse, after } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { createBrand, fetchBrands, runBrandListSideEffects } from "@/lib/data";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";

export async function GET() {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const brands = await fetchBrands();
    after(() => runBrandListSideEffects(brands));
    return NextResponse.json(brands);
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    name?: unknown;
    avatarColor?: unknown;
    linkedinSub?: unknown;
    linkedinEmail?: unknown;
    avatarUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body.name !== "string" || typeof body.linkedinSub !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const brand = await createBrand({
      name: body.name,
      avatarColor: typeof body.avatarColor === "string" ? body.avatarColor : "#6D1472",
      linkedinSub: body.linkedinSub,
      linkedinEmail: typeof body.linkedinEmail === "string" ? body.linkedinEmail : "",
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : "",
    });
    return NextResponse.json(brand);
  } catch (error) {
    if (error instanceof Error && error.message === "already-connected") {
      return NextResponse.json({ error: "already-connected" }, { status: 409 });
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { sendManualLeadMessage } from "@/lib/manual-message";
import { fetchMessages } from "@/lib/outreach-data";
import { UnipileError } from "@/lib/unipile";

export async function GET(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() ?? "";
  if (!brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json(await fetchMessages(brandId));
  } catch (error) {
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { brandId?: unknown; leadId?: unknown; body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body.brandId !== "string" || typeof body.leadId !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await sendManualLeadMessage({
        brandId: body.brandId,
        leadId: body.leadId,
        body: body.body,
      }),
    );
  } catch (error) {
    if (error instanceof UnipileError) {
      const code =
        error.status === 400 || error.status === 403 || error.status === 422
          ? "not-connected"
          : error.message === "unipile-unconfigured"
            ? "seat-disconnected"
            : "send-failed";
      return NextResponse.json({ error: code }, { status: error.status === 429 ? 429 : 400 });
    }
    if (error instanceof Error) {
      const known = [
        "invalid",
        "not-found",
        "test-mode",
        "outreach-paused",
        "seat-disconnected",
        "missing-linkedin",
        "not-connected",
      ];
      if (known.includes(error.message)) {
        return NextResponse.json({ error: error.message }, { status: error.message === "not-found" ? 404 : 400 });
      }
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

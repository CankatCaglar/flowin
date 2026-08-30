import { NextResponse } from "next/server";
import { handleUnipileWebhook } from "@/lib/unipile-webhooks";

function authorized(request: Request) {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const url = new URL(request.url);
  const header = request.headers.get("x-unipile-secret") ?? "";
  return url.searchParams.get("secret") === secret || header === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const result = await handleUnipileWebhook(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[unipile] webhook failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "webhook-failed" }, { status: 500 });
  }
}

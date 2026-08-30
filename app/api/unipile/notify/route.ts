import { NextResponse } from "next/server";
import { attachAccountFromNotify } from "@/lib/unipile-webhooks";

export async function POST(request: Request) {
  let body: { status?: unknown; account_id?: unknown; name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    await attachAccountFromNotify({
      brandId: typeof body.name === "string" ? body.name : "",
      accountId: typeof body.account_id === "string" ? body.account_id : "",
      status: typeof body.status === "string" ? body.status : "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[unipile] notify failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "notify-failed" }, { status: 500 });
  }
}

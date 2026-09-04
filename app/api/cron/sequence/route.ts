import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { runDueSequence } from "@/lib/sequence-runner";

export const maxDuration = 300;

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (secret && header === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!cronAuthorized(request) && !(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await runDueSequence(50);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[cron] sequence failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "sequence-failed" }, { status: 500 });
  }
}

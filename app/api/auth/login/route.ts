import { NextResponse } from "next/server";
import { verifyAdminLogin } from "@/lib/admin";

export async function POST(request: Request) {
  let email = "";
  let password = "";

  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!verifyAdminLogin(email, password)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  return NextResponse.json({
    uid: "flowin-admin",
    email: email.trim().toLowerCase(),
    displayName: "Admin",
  });
}

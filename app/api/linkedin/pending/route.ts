import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { parsePendingProfile } from "@/lib/linkedin";

function clearPending(response: NextResponse) {
  response.cookies.set("flowin_li_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  const admin = await getAdminSessionEmail();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jar = await cookies();
  const profile = parsePendingProfile(jar.get("flowin_li_pending")?.value);
  return NextResponse.json({ profile });
}

export async function DELETE() {
  const admin = await getAdminSessionEmail();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  clearPending(response);
  return response;
}

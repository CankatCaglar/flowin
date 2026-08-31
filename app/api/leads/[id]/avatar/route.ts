import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { avatarResponseHeaders } from "@/lib/brand-avatar";
import { ensureLeadPhoto } from "@/lib/lead-avatar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const image = await ensureLeadPhoto(id);
  if (!image) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return new NextResponse(new Uint8Array(image.buffer), {
    headers: avatarResponseHeaders(image.contentType),
  });
}

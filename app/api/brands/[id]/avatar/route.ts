import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { readBrandAvatar } from "@/lib/brand-avatar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const image = await readBrandAvatar(id);
  if (!image) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}

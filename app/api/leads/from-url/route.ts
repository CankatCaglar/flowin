import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { fetchBrand } from "@/lib/data";
import { linkedInPublicId, normalizeLinkedInUrl } from "@/lib/linkedin-profile";
import { isUnipileConfigured, resolveLinkedInProfile, UnipileError } from "@/lib/unipile";

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { brandId?: unknown; url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (typeof body.brandId !== "string" || typeof body.url !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const linkedinUrl = normalizeLinkedInUrl(body.url);
  const publicId = linkedInPublicId(linkedinUrl);
  if (!linkedinUrl || !publicId) {
    return NextResponse.json({ error: "invalid-url" }, { status: 400 });
  }

  const brand = await fetchBrand(body.brandId);
  if (!brand) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (isUnipileConfigured() && brand.unipileAccountId && brand.unipileStatus === "running") {
    try {
      const lead = await resolveLinkedInProfile(brand.unipileAccountId, linkedinUrl);
      return NextResponse.json({ lead });
    } catch (error) {
      const status = error instanceof UnipileError ? error.status : 502;
      console.error("[leads] from-url failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "lookup-failed" }, { status });
    }
  }

  return NextResponse.json({
    lead: {
      fullName: decodeURIComponent(publicId).replace(/-/g, " "),
      linkedinUrl,
      company: "",
      position: "",
      unipileProviderId: "",
    },
  });
}

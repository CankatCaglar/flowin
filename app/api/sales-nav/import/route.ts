import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { fetchBrand } from "@/lib/data";
import { importSalesNavigatorLeads, isUnipileConfigured } from "@/lib/unipile";

export async function POST(request: Request) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isUnipileConfigured()) {
    return NextResponse.json({ error: "unipile-unconfigured" }, { status: 503 });
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
  const brand = await fetchBrand(body.brandId);
  if (!brand?.unipileAccountId || brand.unipileStatus !== "running") {
    return NextResponse.json({ error: "unipile-disconnected" }, { status: 409 });
  }
  const searchUrl = body.url.trim();
  if (!searchUrl.includes("linkedin.com/sales")) {
    return NextResponse.json({ error: "invalid-url" }, { status: 400 });
  }
  try {
    const leads = await importSalesNavigatorLeads(brand.unipileAccountId, searchUrl);
    return NextResponse.json({
      leads: leads.map((lead) => ({
        fullName: lead.fullName,
        linkedinUrl: lead.linkedinUrl,
        company: lead.company,
        position: lead.position,
        unipileProviderId: lead.providerId,
        pictureUrl: lead.pictureUrl,
      })),
    });
  } catch (error) {
    console.error("[sales-nav] import failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "import-failed" }, { status: 502 });
  }
}

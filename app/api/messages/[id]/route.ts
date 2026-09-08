import { NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-session";
import { deleteOutreachMessage } from "@/lib/delete-message";
import { firebasePayload, firebaseStatus } from "@/lib/firebase";
import { UnipileError } from "@/lib/unipile";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSessionEmail())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const brandId = new URL(request.url).searchParams.get("brandId")?.trim() ?? "";
  if (!id || !brandId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    return NextResponse.json(await deleteOutreachMessage({ brandId, messageId: id }));
  } catch (error) {
    if (error instanceof UnipileError) {
      return NextResponse.json({ error: "linkedin-denied" }, { status: 400 });
    }
    if (error instanceof Error) {
      const known = [
        "invalid",
        "not-found",
        "not-outbound",
        "test-mode",
        "outreach-paused",
        "seat-disconnected",
        "linkedin-missing",
        "linkedin-denied",
        "linkedin-too-old",
      ];
      if (known.includes(error.message)) {
        return NextResponse.json(
          { error: error.message },
          { status: error.message === "not-found" ? 404 : 400 },
        );
      }
    }
    return NextResponse.json(firebasePayload(error), { status: firebaseStatus(error) });
  }
}

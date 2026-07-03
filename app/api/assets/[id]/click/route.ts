import { NextRequest, NextResponse } from "next/server";
import { recordAssetClick } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const assetId = Number(params.id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  try {
    await recordAssetClick(assetId, {
      user: getCurrentUser(),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent")
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

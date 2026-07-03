import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const directoryIdParam = request.nextUrl.searchParams.get("directoryId");
  const keyword = request.nextUrl.searchParams.get("keyword")?.trim() || undefined;
  const type = request.nextUrl.searchParams.get("type")?.trim() || undefined;
  const directoryId = directoryIdParam ? Number(directoryIdParam) : undefined;

  if (directoryIdParam && (!Number.isInteger(directoryId) || Number(directoryId) <= 0)) {
    return NextResponse.json({ error: "directoryId must be a positive integer" }, { status: 400 });
  }

  try {
    const assets = await listAssets({ directoryId, keyword, type });
    return NextResponse.json({ data: assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

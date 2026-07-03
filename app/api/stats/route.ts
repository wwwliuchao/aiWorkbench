import { NextRequest, NextResponse } from "next/server";
import { getAssetStatsByDateRange } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const stats = await getAssetStatsByDateRange({
      startDate: request.nextUrl.searchParams.get("startDate"),
      endDate: request.nextUrl.searchParams.get("endDate"),
      type: request.nextUrl.searchParams.get("type")
    });
    return NextResponse.json({ data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

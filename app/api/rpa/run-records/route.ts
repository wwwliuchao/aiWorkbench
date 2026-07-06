import { NextRequest, NextResponse } from "next/server";
import { listRpaRunRecords } from "@/lib/rpa";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (limitParam && (!Number.isInteger(limit) || Number(limit) <= 0)) {
    return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
  }

  try {
    const records = await listRpaRunRecords({ limit });
    return NextResponse.json({ data: records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

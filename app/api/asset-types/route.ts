import { NextResponse } from "next/server";
import { listAssetTypes } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assetTypes = await listAssetTypes();
    return NextResponse.json({ data: assetTypes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listRecentAssetsForUser } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ data: [] });
  }

  try {
    const assets = await listRecentAssetsForUser(currentUser.id, 4);
    return NextResponse.json({ data: assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

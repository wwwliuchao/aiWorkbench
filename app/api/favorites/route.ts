import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addFavoriteAsset, listFavoriteAssetIds } from "@/lib/favorites";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const assetIds = await listFavoriteAssetIds(currentUser.id);
    return NextResponse.json({ data: assetIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { assetId?: unknown };
    const assetId = Number(body.assetId);

    if (!Number.isInteger(assetId) || assetId <= 0) {
      return NextResponse.json({ error: "assetId must be a positive integer" }, { status: 400 });
    }

    await addFavoriteAsset(currentUser.id, assetId);
    return NextResponse.json({ data: { ok: true, assetId } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

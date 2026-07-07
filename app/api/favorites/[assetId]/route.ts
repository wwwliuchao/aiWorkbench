import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeFavoriteAsset } from "@/lib/favorites";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    assetId: string;
  };
};

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const assetId = Number(context.params.assetId);
  if (!Number.isInteger(assetId) || assetId <= 0) {
    return NextResponse.json({ error: "assetId must be a positive integer" }, { status: 400 });
  }

  try {
    await removeFavoriteAsset(currentUser.id, assetId);
    return NextResponse.json({ data: { ok: true, assetId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

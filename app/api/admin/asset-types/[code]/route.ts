import { NextResponse } from "next/server";
import { requireAdmin, updateAdminAssetType } from "@/lib/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    code: string;
  };
};

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = requireAdmin();
  if (unauthorized) {
    return unauthorized;
  }

  const code = decodeURIComponent(context.params.code).trim();
  if (!code) {
    return NextResponse.json({ error: "Invalid asset type code" }, { status: 400 });
  }

  try {
    await updateAdminAssetType(code, await request.json());
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

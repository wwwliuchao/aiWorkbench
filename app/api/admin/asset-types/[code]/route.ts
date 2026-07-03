import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateAdminAssetType } from "@/lib/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    code: string;
  };
};

function requireUser() {
  return getCurrentUser() ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = requireUser();
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

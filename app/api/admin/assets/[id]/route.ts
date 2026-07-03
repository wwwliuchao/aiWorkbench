import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateAdminAsset } from "@/lib/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
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

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
  }

  try {
    await updateAdminAsset(id, await request.json());
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

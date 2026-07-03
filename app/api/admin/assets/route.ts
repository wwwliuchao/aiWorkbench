import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminAsset, listAdminAssets } from "@/lib/admin";

export const dynamic = "force-dynamic";

function requireUser() {
  return getCurrentUser() ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const unauthorized = requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const assets = await listAdminAssets();
    return NextResponse.json({ data: assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const id = await createAdminAsset(await request.json());
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

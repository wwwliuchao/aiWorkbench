import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { updateQuickServiceGroup } from "@/lib/quick-services";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin();
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  try {
    await updateQuickServiceGroup(id, await request.json());
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

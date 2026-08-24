import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createQuickServiceCard } from "@/lib/quick-services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const id = await createQuickServiceCard(await request.json());
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listEipUsers } from "@/lib/eip";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ data: await listEipUsers() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

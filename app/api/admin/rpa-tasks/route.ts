import { NextResponse } from "next/server";
import { listAdminRpaTasks, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdmin();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const tasks = await listAdminRpaTasks();
    return NextResponse.json({ data: tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

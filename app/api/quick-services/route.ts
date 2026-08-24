import { NextResponse } from "next/server";
import { listQuickServiceGroups } from "@/lib/quick-services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: await listQuickServiceGroups() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

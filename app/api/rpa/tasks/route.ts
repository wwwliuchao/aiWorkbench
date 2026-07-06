import { NextResponse } from "next/server";
import { listRpaTasks } from "@/lib/rpa";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await listRpaTasks();
    return NextResponse.json({ data: tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

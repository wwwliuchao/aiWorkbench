import { NextResponse } from "next/server";
import { listDirectories } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directories = await listDirectories();
    return NextResponse.json({ data: directories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminDirectory, listAdminDirectories } from "@/lib/admin";

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
    const directories = await listAdminDirectories();
    return NextResponse.json({ data: directories });
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
    const id = await createAdminDirectory(await request.json());
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

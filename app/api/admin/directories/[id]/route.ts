import { NextResponse } from "next/server";
import { requireAdmin, updateAdminDirectory } from "@/lib/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = requireAdmin();
  if (unauthorized) {
    return unauthorized;
  }

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid directory id" }, { status: 400 });
  }

  try {
    await updateAdminDirectory(id, await request.json());
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

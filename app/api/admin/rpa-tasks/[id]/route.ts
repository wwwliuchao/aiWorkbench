import { NextResponse } from "next/server";
import { requireAdmin, updateAdminRpaTask } from "@/lib/admin";

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

  const id = decodeURIComponent(context.params.id).trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid RPA task id" }, { status: 400 });
  }

  try {
    await updateAdminRpaTask(id, await request.json());
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

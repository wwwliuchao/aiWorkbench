import { NextRequest, NextResponse } from "next/server";
import { listRpaRunRecords } from "@/lib/rpa";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pageParam = request.nextUrl.searchParams.get("page");
  const pageSizeParam = request.nextUrl.searchParams.get("pageSize");
  const taskUuid = request.nextUrl.searchParams.get("taskUuid")?.trim() || undefined;
  const page = pageParam ? Number(pageParam) : undefined;
  const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined;

  if (pageParam && (!Number.isInteger(page) || Number(page) <= 0)) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  if (pageSizeParam && (!Number.isInteger(pageSize) || Number(pageSize) <= 0)) {
    return NextResponse.json({ error: "pageSize must be a positive integer" }, { status: 400 });
  }

  try {
    const records = await listRpaRunRecords({ page, pageSize, taskUuid });
    return NextResponse.json({ data: records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

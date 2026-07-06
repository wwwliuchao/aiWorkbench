import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRpaTask } from "@/lib/rpa";

export const dynamic = "force-dynamic";

const rpaOperationUrl = "https://z-commander-api.ai-indeed.com/openAPI/v2/job/operation";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = decodeURIComponent(context.params.id).trim();
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  try {
    const task = await getRpaTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "RPA task not found" }, { status: 404 });
    }
    if (!task.taskUuid) {
      return NextResponse.json({ error: "RPA task missing task_uuid" }, { status: 400 });
    }

    const appKey = process.env.RPA_API_APP_KEY;
    const appSecret = process.env.RPA_API_APP_SECRET;

    if (!appKey || !appSecret) {
      return NextResponse.json({ error: "Missing RPA API credentials" }, { status: 500 });
    }

    const upstreamResponse = await fetch(rpaOperationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        appKey,
        appSecret
      },
      body: JSON.stringify({
        jobUuid: task.taskUuid,
        operation: 1
      })
    });

    const rawText = await upstreamResponse.text();
    let upstreamPayload: unknown = null;

    try {
      upstreamPayload = rawText ? JSON.parse(rawText) : null;
    } catch {
      upstreamPayload = rawText || null;
    }

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: "RPA start request failed",
          details: upstreamPayload
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: {
        ok: true,
        taskId: task.id,
        taskUuid: task.taskUuid,
        taskName: task.name,
        operator: currentUser.name,
        message: "启动请求已发送",
        upstream: upstreamPayload
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

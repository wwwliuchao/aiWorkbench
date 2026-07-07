import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRpaTask } from "@/lib/rpa";

export const dynamic = "force-dynamic";

const rpaOperationUrl = "https://z-commander-api.ai-indeed.com/openAPI/v2/job/operation";
const restcloudAppKey = "5eecbdfe8dcb0814749d9edc";
const minRpaTriggerIntervalMs = 30_000;
const rpaTaskLastTriggeredAt = new Map<string, number>();

type RouteContext = {
  params: {
    id: string;
  };
};

function getCooldownRemainingMs(taskId: string) {
  const lastTriggeredAt = rpaTaskLastTriggeredAt.get(taskId);
  if (!lastTriggeredAt) {
    return 0;
  }

  return Math.max(0, minRpaTriggerIntervalMs - (Date.now() - lastTriggeredAt));
}

function parseJsonSafe(rawText: string) {
  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return rawText || null;
  }
}

async function notifyRestcloudLater(taskId: string, taskUuid: string) {
  const restcloudNotifyUrl = process.env.RPA_RESTCLOUD_NOTIFY_URL;
  if (!restcloudNotifyUrl) {
    throw new Error("Missing RPA_RESTCLOUD_NOTIFY_URL");
  }

  const notifyUrl = new URL(restcloudNotifyUrl);
  notifyUrl.searchParams.set("appkey", restcloudAppKey);

  const notifyResponse = await fetch(notifyUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      data: [{ taskId: taskUuid }]
    })
  });

  const notifyRawText = await notifyResponse.text();

  if (!notifyResponse.ok) {
    console.error("Restcloud notify failed", {
      taskId,
      taskUuid,
      status: notifyResponse.status,
      payload: parseJsonSafe(notifyRawText)
    });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = decodeURIComponent(context.params.id).trim();
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const cooldownRemainingMs = getCooldownRemainingMs(taskId);
  if (cooldownRemainingMs > 0) {
    return NextResponse.json(
      {
        error: `单个 RPA 任务需间隔 30 秒才能再次执行，请等待 ${Math.ceil(cooldownRemainingMs / 1000)} 秒后重试`
      },
      { status: 429 }
    );
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

    const upstreamRawText = await upstreamResponse.text();
    const upstreamPayload = parseJsonSafe(upstreamRawText);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: "RPA start request failed",
          details: upstreamPayload
        },
        { status: 502 }
      );
    }

    rpaTaskLastTriggeredAt.set(taskId, Date.now());

    void notifyRestcloudLater(task.id, task.taskUuid).catch((error) => {
      console.error("Restcloud notify failed", {
        taskId: task.id,
        taskUuid: task.taskUuid,
        error
      });
    });

    return NextResponse.json({
      data: {
        ok: true,
        taskId: task.id,
        taskUuid: task.taskUuid,
        taskName: task.name,
        operator: currentUser.name,
        message: "启动请求已发送",
        upstream: upstreamPayload,
        notify: {
          queued: true
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

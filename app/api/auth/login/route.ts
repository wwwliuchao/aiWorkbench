import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { findActiveUserByEmailAndPassword, getDisplayName } from "@/lib/users";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = payload?.email?.trim();
  const password = payload?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  }

  const user = await findActiveUserByEmailAndPassword(email, password);
  if (!user) {
    return NextResponse.json({ error: "邮箱或密码错误，或用户已停用" }, { status: 401 });
  }

  const response = NextResponse.json({
    data: {
      ok: true,
      user: {
        id: user.workcode!,
        name: getDisplayName(user),
        email: user.email,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        provider: "password",
        isAdmin: user.isManager === 1
      }
    }
  });

  setSessionCookie(
    response,
    {
      id: user.workcode!,
      name: getDisplayName(user),
      email: user.email,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      provider: "password",
      isAdmin: user.isManager === 1
    },
    request
  );

  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, shouldUseSecureCookie } from "@/lib/auth";
import { getPublicUrl } from "@/lib/public-path";
import { findActiveUserByEmail, getDisplayName } from "@/lib/users";

type FeishuApiResponse<T> = {
  code?: number;
  msg?: string;
  data?: T;
  app_access_token?: string;
};

type AppAccessTokenData = {
  app_access_token?: string;
};

type UserAccessTokenData = {
  access_token?: string;
};

type FeishuUserInfoData = {
  email?: string;
  user_info?: {
    email?: string;
  };
};

async function getFeishuAppAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    return null;
  }

  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });
  const payload = (await response.json()) as FeishuApiResponse<AppAccessTokenData>;

  return payload.data?.app_access_token ?? payload.app_access_token ?? null;
}

async function getFeishuUserAccessToken(code: string, appAccessToken: string) {
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code
    })
  });
  const payload = (await response.json()) as FeishuApiResponse<UserAccessTokenData>;

  return payload.data?.access_token ?? null;
}

async function getFeishuUserEmail(userAccessToken: string) {
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: {
      Authorization: `Bearer ${userAccessToken}`
    }
  });
  const payload = (await response.json()) as FeishuApiResponse<FeishuUserInfoData>;

  return payload.data?.email ?? payload.data?.user_info?.email ?? null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("asset_portal_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_missing_code"));
  }

  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_state_invalid"));
  }

  const appAccessToken = await getFeishuAppAccessToken();
  if (!appAccessToken) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_token_failed"));
  }

  const userAccessToken = await getFeishuUserAccessToken(code, appAccessToken);
  if (!userAccessToken) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_token_failed"));
  }

  const email = await getFeishuUserEmail(userAccessToken);
  if (!email) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_email_missing"));
  }

  const user = await findActiveUserByEmail(email);
  if (!user) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_user_not_found"));
  }

  const response = NextResponse.redirect(getPublicUrl("/"));
  setSessionCookie(
    response,
    {
      id: user.workcode!,
      name: getDisplayName(user),
      email: user.email,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      provider: "feishu",
      isAdmin: user.isManager === 1
    },
    request
  );
  response.cookies.set("asset_portal_oauth_state", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request)
  });

  return response;
}

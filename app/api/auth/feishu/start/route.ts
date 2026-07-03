import { NextRequest, NextResponse } from "next/server";
import { shouldUseSecureCookie } from "@/lib/auth";
import { getPublicUrl } from "@/lib/public-path";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const appId = process.env.FEISHU_APP_ID;
  const redirectUri = 
    process.env.FEISHU_REDIRECT_URI ?? `${getBaseUrl(request)}/api/auth/feishu/callback`;
    
  if (!appId) {
    return NextResponse.redirect(getPublicUrl("/login?error=feishu_not_configured"));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://open.feishu.cn/open-apis/authen/v1/index");
  authorizeUrl.searchParams.set("app_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("asset_portal_oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request)
  });

  return response;
}

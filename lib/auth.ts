import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const authCookieName = "asset_portal_session";

export type SessionUser = {
  id: number;
  name: string;
  email: string | null;
  departmentName: string | null;
  provider: "password" | "feishu";
};

function encodeSession(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export function decodeSession(value?: string): SessionUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  return decodeSession(cookies().get(authCookieName)?.value);
}

function getRequestProtocol(request?: Request) {
  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto;
  }

  if (request?.url) {
    return new URL(request.url).protocol.replace(":", "");
  }

  return null;
}

export function shouldUseSecureCookie(request?: Request) {
  const explicitSecure = process.env.AUTH_COOKIE_SECURE;
  if (explicitSecure === "true") {
    return true;
  }
  if (explicitSecure === "false") {
    return false;
  }

  const requestProtocol = getRequestProtocol(request);
  if (requestProtocol) {
    return requestProtocol === "https";
  }

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (publicAppUrl) {
    return publicAppUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(response: NextResponse, user: SessionUser, request?: Request) {
  response.cookies.set(authCookieName, encodeSession(user), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request)
  });
}

export function clearSessionCookie(response: NextResponse, request?: Request) {
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request)
  });
}

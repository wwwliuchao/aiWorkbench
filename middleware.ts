import { NextRequest, NextResponse } from "next/server";
import { getPublicUrl, publicBasePath } from "@/lib/public-path";

const authCookieName = "asset_portal_session";
const publicPaths = ["/login"];
const publicApiPrefixes = ["/api/auth"];
const publicAssetPrefixes = ["/assets/"];

export function middleware(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  const pathname =
    publicBasePath && rawPathname.startsWith(publicBasePath)
      ? rawPathname.slice(publicBasePath.length) || "/"
      : rawPathname;
  const isPublicPage = publicPaths.some((path) => pathname === path);
  const isPublicApi = publicApiPrefixes.some((path) => pathname.startsWith(path));
  const isPublicAsset = publicAssetPrefixes.some((path) => pathname.startsWith(path));
  const hasSession = Boolean(request.cookies.get(authCookieName)?.value);

  if (isPublicPage || isPublicApi || isPublicAsset || hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  return NextResponse.redirect(getPublicUrl("/login"));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

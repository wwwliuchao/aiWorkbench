const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const publicBasePath =
  rawBasePath && rawBasePath !== "/" ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}` : "";

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicBasePath}${normalizedPath}`;
}

export function getPublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/g, "");

  if (appUrl) {
    return normalizedPath ? `${appUrl}/${normalizedPath}` : appUrl;
  }

  return normalizedPath ? withBasePath(`/${normalizedPath}`) : publicBasePath || "/";
}

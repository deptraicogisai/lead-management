import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";
import { getSafeReturnUrl } from "@/lib/auth-return-url";

function isProtectedPagePath(pathname: string) {
  return pathname !== "/login" && pathname !== "/";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const currentPath = `${pathname}${search}`;
  const session = decodeAuthSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/redirect") {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (session) {
      const returnUrl = getSafeReturnUrl(request.nextUrl.searchParams.get("returnUrl"));
      return NextResponse.redirect(new URL(returnUrl ?? "/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
  }

  if (!session && isProtectedPagePath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", currentPath);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", currentPath);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public auth and signup routes
const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js internals pass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes("favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Retrieve token from cookie (usually populated by server backend login)
  const token = request.cookies.get("auth_token")?.value;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  if (!token && !isPublic) {
    // Redirect to login page
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublic && pathname !== "/") {
    // Already authenticated, send to dashboard home
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

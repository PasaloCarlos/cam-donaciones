import { NextResponse, type NextRequest } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-session";

// UX gate only — real enforcement lives in requireAdmin() inside every admin
// Server Action. Never trust the proxy alone.
// The matcher already excludes /admin/login, _next/*, favicons — so every
// request that reaches here requires a valid session.
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!(await verifySession(cookie))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|admin/login).*)"],
};

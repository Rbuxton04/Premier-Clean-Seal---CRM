import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/request-quote(.*)",
  "/quote/(.*)",
  "/unsubscribe/(.*)",
  "/book/(.*)",
  "/api/public/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/api/portal/(.*)",
  "/portal/(.*)",
]);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Forwards the request pathname as a header so Server Components (which
// can't read the current URL directly in the App Router) can make routing
// decisions — used by (crm)/layout.tsx to confine the read-only ACCOUNTANT
// role to the Finance area server-side, not just by hiding sidebar links.
function withPathnameHeader(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

// When Clerk keys are absent (first local run) the app is open — dev mode only.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) await auth.protect();
      return withPathnameHeader(req);
    })
  : (req: NextRequest) => withPathnameHeader(req);

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};

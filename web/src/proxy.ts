import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed Middleware to Proxy. The file is `proxy.ts`, the export is
 * `proxy`, and the runtime is Node and cannot be configured.
 *
 * Two jobs, both cheap:
 *
 *   1. Refresh the Supabase session and write the rotated tokens onto the
 *      response. Server Components cannot set cookies, so without this a
 *      refreshed token would be dropped and the user would be logged out at
 *      random.
 *   2. An optimistic redirect so a signed-out visitor never reaches an /app
 *      render. This is a convenience, not a security boundary: the real check
 *      is `requireSession()` in src/lib/dal.ts, which runs against the data.
 *
 * No database work here. Proxy runs on prefetches too, so anything slow would
 * be paid for on every hovered link.
 */

const PROTECTED_PREFIX = "/app";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Not configured yet. Let the request through and let the page render the
  // real "Supabase Auth is not configured" error, rather than redirect-looping.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Supabase passes no-store headers alongside rotated auth cookies.
        // Without them a CDN could cache one gym's session and hand it to
        // another.
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Must happen before the response is committed, or a refresh completing later
  // has nowhere to write.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith(PROTECTED_PREFIX) && !user) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  if (path === "/login" && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};

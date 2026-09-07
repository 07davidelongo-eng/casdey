import { NextResponse, type NextRequest } from "next/server";

import {
  RECOVERY_COOKIE,
  RECOVERY_WINDOW_SECONDS,
  RESET_PATH,
} from "@/lib/password-recovery";
import { supabaseServer } from "@/lib/supabase-server";
import { safeNextPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where Supabase sends the browser back to after Google sign-in, or after
 * someone clicks the confirmation link in a signup email.
 *
 * The code in the query string is exchanged for a session here, server-side, so
 * the session cookie is set with HttpOnly by the route handler rather than
 * written from JavaScript.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  // Google's own failures come back as query parameters, not as an exception.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return redirectToLogin(origin, providerError);
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirectToLogin(origin, "That sign-in link is missing its code.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most often an expired or already-used link.
    return redirectToLogin(
      origin,
      "That sign-in link has expired or was already used. Try again.",
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  // A recovery link, and only a recovery link, earns the right to set a new
  // password without knowing the old one.
  //
  // Supabase hands back an ordinary session for a recovery code, with nothing
  // on it that says how it was obtained, so without this marker /reset-password
  // cannot tell "clicked the emailed link two seconds ago" from "was already
  // signed in on this laptop". Treating those the same is what let anyone with
  // a borrowed session change the password and lock the owner out.
  //
  // Short-lived on purpose: it grants the weaker check, so it should outlive
  // the click and nothing more.
  if (next === RESET_PATH) {
    response.cookies.set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RECOVERY_WINDOW_SECONDS,
    });
  }

  return response;
}

function redirectToLogin(origin: string, message: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

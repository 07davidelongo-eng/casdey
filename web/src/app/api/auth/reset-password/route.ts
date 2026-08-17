import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completes a password reset. The recovery link the user clicked was exchanged
 * for a session by /auth/callback, so by the time this runs there is a signed-in
 * user in the cookie; updateUser sets the new password against it.
 *
 * Done server-side deliberately: the session cookie is HttpOnly, so the browser
 * client cannot read it, and doing this from the client would fail with "not
 * authenticated" even though the recovery session is perfectly valid.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin;
  const back = new URL("/reset-password", origin);

  const form = await request.formData().catch(() => null);
  const password = form ? String(form.get("password") ?? "") : "";

  if (password.length < 8) {
    back.searchParams.set(
      "error",
      "Your new password must be at least 8 characters.",
    );
    return NextResponse.redirect(back, 303);
  }

  const supabase = await supabaseServer();

  // A recovery link that has expired or was already used leaves no session.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    back.searchParams.set(
      "error",
      "That reset link has expired or was already used. Request a new one from the sign-in page.",
    );
    return NextResponse.redirect(back, 303);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back, 303);
  }

  // Signed in with the new password already; drop them into the app.
  return NextResponse.redirect(new URL("/app", origin), 303);
}

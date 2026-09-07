import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  MIN_PASSWORD_LENGTH,
  RECOVERY_COOKIE,
  RESET_PATH,
} from "@/lib/password-recovery";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completes a password change, from either of the two routes into it.
 *
 * Done server-side deliberately: the session cookie is HttpOnly, so the browser
 * client cannot read it, and doing this from the client would fail with "not
 * authenticated" even though the recovery session is perfectly valid.
 *
 * See src/lib/password-recovery.ts for why a recovery and an in-session change
 * are held to different proofs.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin;
  const back = new URL(RESET_PATH, origin);

  const form = await request.formData().catch(() => null);
  const password = form ? String(form.get("password") ?? "") : "";
  const confirm = form ? String(form.get("confirm") ?? "") : "";
  const current = form ? String(form.get("current") ?? "") : "";

  const fail = (message: string) => {
    back.searchParams.set("error", message);
    return NextResponse.redirect(back, 303);
  };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(
      `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  // Caught here rather than in the browser alone: a typo in a password nobody
  // can read back is how somebody locks themselves out of an account they were
  // in the middle of recovering.
  if (password !== confirm) {
    return fail("Those two passwords do not match.");
  }

  const supabase = await supabaseServer();

  // A recovery link that has expired or was already used leaves no session.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail(
      "That reset link has expired or was already used. Request a new one from the sign-in page.",
    );
  }

  const store = await cookies();
  const viaRecovery = store.get(RECOVERY_COOKIE)?.value === "1";

  if (!viaRecovery) {
    // Signed in, but not from a link emailed to this address moments ago. The
    // current password is the only thing separating the account owner from
    // whoever else is sitting at this browser.
    if (!current) {
      return fail(
        "Enter your current password to change it. If you have forgotten it, sign out and use the reset link on the sign-in page.",
      );
    }
    if (!user.email) {
      return fail(
        "This account has no email address to check a password against. Use the reset link on the sign-in page.",
      );
    }
    const { error: wrong } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (wrong) {
      return fail("That current password is not right.");
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return fail(error.message);
  }

  // Whatever prompted a password change, the other sessions are the thing it
  // is meant to end. Supabase leaves them signed in otherwise, so a stolen
  // session survives the very change made to revoke it. This browser keeps
  // its own session, so the user is not bounced out of the flow they just
  // finished.
  await supabase.auth.signOut({ scope: "others" }).catch(() => {
    // Best effort. The password is already changed, and failing here must not
    // read to the user as the change itself having failed.
  });

  const response = NextResponse.redirect(new URL("/app", origin), 303);
  // Spent. Leaving it would let a second change ride the same recovery.
  response.cookies.set(RECOVERY_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

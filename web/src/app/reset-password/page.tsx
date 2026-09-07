import { cookies } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/app/ui";
import { Wordmark } from "@/components/wordmark";
import {
  MIN_PASSWORD_LENGTH,
  RECOVERY_COOKIE,
} from "@/lib/password-recovery";
import { supabaseServer } from "@/lib/supabase-server";

import "@/styles/product.css";

export const metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * Where a password-recovery link lands after /auth/callback has exchanged its
 * code for a session, and also where a signed-in user changes their password.
 *
 * Three states, and telling them apart is the whole job of this page:
 *
 *   - RECOVERY. Came from the emailed link, marked by the cookie /auth/callback
 *     sets. Ask for the new password only.
 *   - SIGNED IN. A valid session but no recovery marker. Ask for the current
 *     password too, because a session is not proof of the person.
 *   - NEITHER. An expired or already-used link, or somebody who navigated here
 *     directly. Say so, rather than showing a form that can only fail.
 *
 * The route handler this posts to enforces all of it again. This page decides
 * what to render; it decides nothing about what is allowed.
 *
 * Lives at the top level, not under /app, so it is reachable on nothing but the
 * short-lived recovery session without tripping the gym-active gate.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  const store = await cookies();
  const viaRecovery = store.get(RECOVERY_COOKIE)?.value === "1";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[27rem]">
        <Link
          href="/"
          className="mb-7 inline-block text-ink transition-opacity duration-200 hover:opacity-70"
        >
          <Wordmark className="text-[1.75rem]" />
        </Link>

        <div className="card p-7">
          <h1 className="display text-[1.5rem]">
            {user && !viaRecovery ? "Change your password" : "Set a new password"}
          </h1>

          {!user ? (
            <>
              <p className="mt-2 text-[0.9375rem] text-graphite">
                This link has expired or was already used. Reset links are good
                for one use, so this is normal if you opened it twice.
              </p>
              {error ? (
                <p role="alert" className="notice notice-error mt-4">
                  {error}
                </p>
              ) : null}
              <Link
                href="/login?mode=reset"
                className="mt-6 inline-block underline"
              >
                Send me a new link
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-[0.9375rem] text-graphite">
                {viaRecovery
                  ? "Choose a new password for your casdey account. Signing in anywhere else will need the new one."
                  : "You are signed in, so we need your current password before we change it. Everywhere else you are signed in will be signed out."}
              </p>

              {error ? (
                <p role="alert" className="notice notice-error mt-4">
                  {error}
                </p>
              ) : null}

              <form
                action="/api/auth/reset-password"
                method="post"
                className="mt-6"
              >
                {/* Not asked during a recovery: the whole reason someone is
                    holding an emailed link is that they do not know it. */}
                {!viaRecovery ? (
                  <div className="mb-5">
                    <label htmlFor="current" className="field-label">
                      Current password
                    </label>
                    <input
                      id="current"
                      name="current"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="field"
                    />
                  </div>
                ) : null}

                <div className="mb-5">
                  <label htmlFor="password" className="field-label">
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="field"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  />
                </div>

                <div className="mb-5">
                  <label htmlFor="confirm" className="field-label">
                    New password again
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="field"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Save new password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

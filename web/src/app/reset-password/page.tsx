import Link from "next/link";

import { Button } from "@/components/app/ui";
import { Wordmark } from "@/components/wordmark";

import "@/styles/product.css";

export const metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/**
 * Where a password-recovery link lands after /auth/callback has exchanged its
 * code for a session. The new password is saved server-side by the route
 * handler this form posts to, so it works off the HttpOnly session cookie the
 * callback set rather than anything read in the browser.
 *
 * Lives at the top level, not under /app, so it is reachable on nothing but the
 * short-lived recovery session without tripping the gym-active gate.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : null;

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
          <h1 className="display text-[1.5rem]">Set a new password</h1>
          <p className="mt-2 text-[0.9375rem] text-graphite">
            Choose a new password for your casdey account.
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
                minLength={8}
                className="field"
                placeholder="At least 8 characters"
              />
            </div>

            <Button type="submit" className="w-full">
              Save new password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

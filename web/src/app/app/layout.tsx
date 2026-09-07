import Link from "next/link";

import { AppNav } from "@/components/app/nav";
import { IconSignOut } from "@/components/app/icons";
import { Logo } from "@/components/wordmark";
import { cookies } from "next/headers";

import { getGymContext } from "@/lib/dal";
import { BillingBanner } from "@/components/app/billing-banner";
import { SupportWidget } from "@/components/app/support-widget";
import { UnsavedChangesGuard } from "@/components/app/unsaved-changes";
import { ThemeToggle, THEME_COOKIE } from "@/components/app/theme-toggle";

import "@/styles/product.css";

/**
 * The app shell.
 *
 * It reads the gym only to label the sidebar. It deliberately performs no
 * authorization: layouts do not re-render on client-side navigation and cannot
 * stop the segments below them from rendering, so a check here would look like
 * a gate without being one. Each page calls requireGym() (or
 * requireActiveGym()) itself. See src/lib/dal.ts.
 *
 * A gym can legitimately be missing here: /app/onboarding is where a new
 * user creates one.
 */

export const metadata = {
  // The template has to be restated here, not just the name. A plain string
  // title carries no template, so the root's "%s · casdey" reached /app but
  // died one segment further down: "Overview · casdey" but a bare "Members".
  title: { default: "casdey", template: "%s · casdey" },
  robots: { index: false, follow: false },
};

// Nothing under /app is ever the same for two people, so none of it is static.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const context = await getGymContext();

  // Read here rather than guessed in the browser, so the first paint is
  // already the theme the gym owner chose and React never has to reconcile a
  // document something else has already changed underneath it.
  const theme =
    (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";

  return (
    <div
      data-theme={theme}
      className="flex min-h-full flex-1 flex-col bg-paper md:flex-row"
    >
      {/* Sticky and exactly one viewport tall on desktop, with its own scroll.
          As a plain flex child it stretched to the height of whatever page it
          sat beside, which put the gym name, the theme switch and sign out at
          the foot of a long document instead of the foot of the screen: on
          Settings you had to scroll the page to reach the controls that are
          supposed to be always there. */}
      <aside className="app-sidebar on-deep flex shrink-0 flex-col gap-6 px-4 py-4 md:sticky md:top-0 md:h-[100dvh] md:w-60 md:overflow-y-auto md:px-5 md:py-7">
        <div className="flex items-center justify-between md:block">
          <Link href="/app" className="inline-block text-ink">
            <Logo className="text-[1.5rem]" />
          </Link>
          {/* The sidebar footer that carries the full switch is desktop only,
              so on a phone this is the only way to reach it. */}
          <div className="md:hidden">
            <ThemeToggle initial={theme} compact />
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:flex-1 md:overflow-visible md:px-0">
          <AppNav />
        </div>

        {context ? (
          <div className="hidden border-t border-deep-line pt-4 md:block">
            <p className="truncate text-[0.9375rem] text-ink">
              {context.gym.name}
            </p>
            <p className="literal truncate text-[0.75rem] text-sea/80">
              {context.session.email}
            </p>
            <div className="mt-3 -mx-2.5">
              <ThemeToggle initial={theme} />
            </div>

            <form action="/auth/signout" method="post" className="mt-1">
              <button
                type="submit"
                className="app-nav-link -mx-3 w-[calc(100%+1.5rem)] text-left"
              >
                <IconSignOut className="h-[1.125rem] w-[1.125rem]" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {context ? <BillingBanner gym={context.gym} /> : null}
        <main className="mx-auto w-full max-w-[68rem] flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>

      <SupportWidget />
      <UnsavedChangesGuard />
    </div>
  );
}

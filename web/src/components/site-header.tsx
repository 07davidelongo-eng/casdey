import Link from "next/link";
import { ButtonLink, Container } from "./ui";
import { Logo } from "./wordmark";

/*
 * Simplified while casdey.com is unpublished down to /waitlist and /privacy
 * (see next.config.ts redirects and CLAUDE.md, "Niche pivot under
 * consideration"). The full nav (How it works, Why casdey, Member data,
 * Sign in) pointed at the homepage and /login, both currently redirected
 * back to /waitlist, so every one of those links was a dead end. Restore
 * the full nav once the site republishes.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ash/70 bg-paper/85 backdrop-blur-md">
      <Container>
        <div className="flex h-[72px] items-center justify-between gap-6">
          <Link
            href="/"
            aria-label="casdey, home"
            className="shrink-0 text-ink"
          >
            <Logo className="text-[1.6rem]" />
          </Link>

          <ButtonLink href="/waitlist" className="px-4 py-2.5">
            Join the waitlist
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}

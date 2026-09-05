import Link from "next/link";
import { ButtonLink, Container } from "./ui";
import { Logo } from "./wordmark";

/*
 * The V1 nav. This was cut down to a single "Join the waitlist" button while
 * casdey.com was unpublished to /waitlist, which made the homepage advertise
 * a waitlist for a product that now exists. The links point at the sections
 * below and at the real sign-in.
 */
const LINKS = [
  { href: "/#what-it-does", label: "What it does" },
  { href: "/#why-casdey", label: "Why casdey" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ash/70 bg-paper/80 backdrop-blur-md">
      <Container>
        <div className="flex h-[68px] items-center gap-8">
          <Link href="/" aria-label="casdey, home" className="shrink-0 text-ink">
            <Logo className="text-[1.5rem]" />
          </Link>

          <nav className="hidden gap-7 md:flex" aria-label="Sections">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink"
            >
              Sign in
            </Link>
            <ButtonLink
              href="/login?mode=signup"
              className="px-4 py-2 text-[0.875rem]"
            >
              Start free
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}

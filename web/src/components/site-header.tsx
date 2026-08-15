import Link from "next/link";
import { ButtonLink, Container } from "./ui";
import { Wordmark } from "./wordmark";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-casdey", label: "Why casdey" },
  { href: "/#patient-data", label: "Patient data" },
];

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
            <Wordmark className="text-[1.6rem]" />
          </Link>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-9">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="hidden px-3 py-2.5 text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink sm:inline-block"
            >
              Sign in
            </Link>
            <ButtonLink href="/login?mode=signup" className="px-4 py-2.5">
              Start free week
            </ButtonLink>
          </div>
        </div>
      </Container>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ButtonLink, Container } from "./ui";
import { Logo } from "./wordmark";

/**
 * A floating island, not a bar.
 *
 * A full-bleed sticky bar welded to the top edge is the default, and it
 * fights the page: it cuts the hero's gradient off with a hard horizontal
 * line. Detaching it leaves the wash running under the whole viewport and
 * the nav reads as an object on top of the page rather than a lid on it.
 *
 * It is fixed rather than sticky, so the spacer below reserves its height.
 * Keeping that spacer here means every page using the header gets the offset
 * without knowing about it.
 */
const LINKS = [
  { href: "/#what-it-does", label: "What it does" },
  { href: "/#why-casdey", label: "Why casdey" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 pt-3 sm:pt-4">
        <Container>
          <div
            className={
              "flex h-[58px] items-center gap-6 rounded-[16px] border px-3 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 sm:gap-8 sm:px-4 " +
              (lifted
                ? "border-ash bg-paper/85 shadow-float"
                : "border-transparent bg-paper/40")
            }
          >
            <Link
              href="/"
              aria-label="casdey, home"
              className="shrink-0 text-ink"
            >
              <Logo className="text-[1.4rem]" />
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

            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <Link
                href="/login"
                className="text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink"
              >
                Sign in
              </Link>
              <ButtonLink href="/login?mode=signup" size="sm">
                Start free
              </ButtonLink>
            </div>
          </div>
        </Container>
      </header>

      <div aria-hidden="true" className="h-[70px] sm:h-[74px]" />
    </>
  );
}

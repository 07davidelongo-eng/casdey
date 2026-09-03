import Link from "next/link";
import { Container } from "./ui";
import { Wordmark } from "./wordmark";

/*
 * Simplified while casdey.com is unpublished down to /waitlist and /privacy
 * (see next.config.ts redirects and CLAUDE.md, "Niche pivot under
 * consideration"). Product and Get started both pointed at the homepage
 * and /login, currently redirected back to /waitlist, so those columns were
 * all dead ends. info@casdey.com is already shown above, so it isn't
 * repeated here. Restore the full columns once the site republishes.
 */
const COLUMNS = [
  {
    heading: "Legal",
    links: [{ href: "/privacy", label: "Privacy notice" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ash/70 py-14">
      <Container>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr]">
          <div>
            <Wordmark className="text-[1.6rem] text-ink" />
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
              Lapsed-member reactivation for gyms and studios in the UK and
              the EU.
            </p>
            <a
              href="mailto:info@casdey.com"
              className="label mt-5 inline-block text-teal transition-colors duration-200 hover:text-teal-hover"
            >
              info@casdey.com
            </a>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="label text-stone">{column.heading}</p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.9375rem] text-graphite transition-colors duration-200 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="label mt-14 border-t border-ash/70 pt-8 text-stone">
          © {new Date().getFullYear()} casdey
        </p>
      </Container>
    </footer>
  );
}

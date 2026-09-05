import Link from "next/link";
import { Container } from "./ui";
import { Logo } from "./wordmark";

/*
 * Restored for V1. The Product and Get started columns were removed while
 * casdey.com redirected everything to /waitlist, which made them dead ends.
 * They are live routes again, so they are back.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#what-it-does", label: "What it does" },
      { href: "/#why-casdey", label: "Why casdey" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/login?mode=signup", label: "Start your free week" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy notice" },
      { href: "/terms/processing", label: "Data processing" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ash/70 py-14">
      <Container>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <Logo className="text-[1.6rem] text-ink" />
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
              Lapsed-member reactivation for gyms and studios in the UK and the
              EU.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <a
                href="mailto:info@casdey.com"
                className="label text-teal transition-colors duration-200 hover:text-teal-hover"
              >
                info@casdey.com
              </a>
              <a
                href="https://instagram.com/casdey.co"
                className="label text-teal transition-colors duration-200 hover:text-teal-hover"
              >
                @casdey.co
              </a>
            </div>
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

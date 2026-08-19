import Link from "next/link";
import { Container } from "./ui";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#why-casdey", label: "Why casdey" },
      { href: "/#patient-data", label: "Member data" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/login?mode=signup", label: "Start your free week" },
      { href: "/login", label: "Sign in" },
      { href: "mailto:info@casdey.com", label: "Talk to us" },
    ],
  },
  {
    heading: "Legal",
    links: [{ href: "/privacy", label: "Privacy notice" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ash/70 py-14">
      <Container>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark className="text-[1.6rem] text-ink" />
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
              Cancelled-member reactivation for gyms and studios in the UK
              and the EU.
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

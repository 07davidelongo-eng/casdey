"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings", label: "Practice" },
  { href: "/app/settings/services", label: "Service prices" },
  { href: "/app/settings/whatsapp", label: "WhatsApp" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/data", label: "Data and privacy" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="mt-5 mb-8 flex gap-1 overflow-x-auto border-b border-ash"
    >
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-[0.9375rem] whitespace-nowrap transition-colors duration-200 ${
              active
                ? "border-teal font-semibold text-teal"
                : "border-transparent text-graphite hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings", label: "Gym" },
  { href: "/app/settings/services", label: "Services" },
  { href: "/app/settings/booking", label: "Booking" },
  { href: "/app/settings/sending", label: "Sending" },
  { href: "/app/settings/whatsapp", label: "WhatsApp" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/data", label: "Data and privacy" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  // overflow-y-hidden below is load-bearing, not tidying. CSS promotes the
  // other axis to `auto` as soon as one axis is not `visible`, and the active
  // tab's -mb-px makes the content a pixel taller than the box, so Chrome
  // painted a real vertical scrollbar beside the tabs for that one pixel.
  return (
    <nav
      aria-label="Settings sections"
      className="mt-5 mb-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-ash"
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

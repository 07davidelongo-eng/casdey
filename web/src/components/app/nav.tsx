"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconFind, IconMessage } from "@/components/marks/icons";
import { IconOverview, IconSettings, IconUpload } from "./icons";

const LINKS = [
  { href: "/app", label: "Overview", Icon: IconOverview, exact: true },
  { href: "/app/members", label: "Members", Icon: IconFind, exact: false },
  { href: "/app/import", label: "Import", Icon: IconUpload, exact: false },
  { href: "/app/campaigns", label: "Campaigns", Icon: IconMessage, exact: false },
  { href: "/app/settings", label: "Settings", Icon: IconSettings, exact: false },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex gap-1 md:flex-col">
      {LINKS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="app-nav-link"
          >
            <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

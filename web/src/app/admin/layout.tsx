import { cookies } from "next/headers";

import { Logo } from "@/components/wordmark";
import { ThemeToggle, THEME_COOKIE } from "@/components/app/theme-toggle";
import { requireAdmin } from "@/lib/admin";

import "@/styles/product.css";

/**
 * The founder-only shell.
 *
 * Deliberately not nested under src/app/app/layout.tsx: that shell reads a
 * single gym for its sidebar, and this page is cross-gym by design. It shares
 * the same product.css and component set so it reads as the same product,
 * not a bolted-on tool.
 *
 * requireAdmin() here is a convenience, same caveat as AppLayout's own
 * comment: layouts do not re-render on client navigation and cannot stop a
 * segment below them from rendering. The real gate is requireAdmin() called
 * again in page.tsx. Belt and braces costs nothing on a route only one person
 * ever opens.
 */

export const metadata = {
  title: { default: "casdey HQ", template: "%s · casdey HQ" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  await requireAdmin();

  const theme =
    (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";

  return (
    <div
      data-theme={theme}
      className="flex min-h-full flex-1 flex-col bg-paper text-ink"
    >
      <header className="flex items-center justify-between border-b border-ash px-6 py-4">
        <Logo className="text-[1.25rem]" />
        <div className="flex items-center gap-4">
          <span className="label text-stone">Founder view</span>
          <ThemeToggle initial={theme} compact />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

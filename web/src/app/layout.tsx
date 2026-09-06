import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Outfit } from "next/font/google";
import "./globals.css";

// Titles and the wordmark. One face for both, so the logo is not a stranger
// to the headline sitting under it.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Everything that gets read. Chosen against Outfit, not to match it.
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const description =
  "casdey finds the members who visited your gym once or twice and never returned, then writes to them in your name so the ones worth winning back reply straight to your front desk. No manual chasing, no ad spend.";

export const metadata: Metadata = {
  metadataBase: new URL("https://casdey.com"),
  title: {
    default: "casdey · lapsed-member reactivation for gyms and studios",
    template: "%s · casdey",
  },
  description,
  applicationName: "casdey",
  keywords: [
    "gym membership software",
    "cancelled member reactivation",
    "lapsed members",
    "member win-back",
    "gym and studio growth",
  ],
  openGraph: {
    type: "website",
    siteName: "casdey",
    title: "casdey · reactivate the members you already earned",
    description,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "casdey · reactivate the members you already earned",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning covers this element's attributes only, and it
    // is here for exactly one of them. The product's no-flash theme script
    // (see components/app/theme-toggle.tsx) stamps data-theme on <html> before
    // React hydrates, which is the point of it: the alternative is a white
    // flash on every dark-mode page load. React then compares the server's
    // markup against a DOM that has deliberately moved and reports a mismatch
    // it cannot patch. The divergence is intended and one attribute wide.
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${outfit.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import {
  Familjen_Grotesk,
  Inter,
  JetBrains_Mono,
  Raleway,
} from "next/font/google";
import "./globals.css";

// The wordmark only. Never used for anything smaller.
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["300"],
  display: "swap",
});

// Headlines.
const familjen = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Everything that gets read.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Anything literal: dates, counts, field hints.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "casdey finds the patients who visited your practice once or twice and never rebooked, then writes to them in your name so the ones worth winning back reply straight to your front desk. No manual chasing, no ad spend.";

export const metadata: Metadata = {
  metadataBase: new URL("https://casdey.com"),
  title: {
    default: "casdey · dormant-patient reactivation for dental practices",
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
    title: "casdey · reactivate the patients you already earned",
    description,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "casdey · reactivate the patients you already earned",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#17140f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${raleway.variable} ${familjen.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { NextConfig } from "next";

// Applied to every response. These are the low-risk, no-config-needed headers:
// they don't constrain where scripts/styles/data can come from, so they can't
// break the app. HSTS is deliberately left to Vercel (which already sets it);
// a full script/style/connect CSP is a separate, test-heavy task and is not
// added here. `frame-ancestors 'self'` is the one CSP directive included, as
// the modern clickjacking defense alongside X-Frame-Options.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // The dev overlay badge sits on top of the page and lands in design
  // screenshots, which makes comparing passes harder than it needs to be.
  devIndicators: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  async redirects() {
    // The landing page lives at the root. /homepage is kept as an alias so a
    // link written that way still lands somewhere sensible.
    const always = [
      { source: "/homepage", destination: "/", permanent: false },
    ];

    // Published 2026-09-07. casdey.com now serves the product to anyone.
    //
    // History, because the shape of this block mattered for three weeks: the
    // whole site was redirected to /waitlist during the dental→gym pivot
    // (2026-08-19), narrowed on 2026-08-23 so only the marketing homepage
    // stayed behind /waitlist while invited gyms used /app, and removed here
    // once the V1 gates were met. /waitlist is deliberately kept reachable at
    // its own URL: the cold outreach has been linking to it since August and
    // those links must not break.
    //
    // To un-publish again, restore:
    //   { source: "/", destination: "/waitlist", permanent: false }
    // guarded by NODE_ENV === "production". It was a temporary 307, never a
    // permanent redirect, precisely so republishing needs no cache to expire.
    return always;
  },
};

export default nextConfig;

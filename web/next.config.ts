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
    return [
      // The landing page lives at the root. /homepage is kept as an alias so a
      // link written that way still lands somewhere sensible.
      { source: "/homepage", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;

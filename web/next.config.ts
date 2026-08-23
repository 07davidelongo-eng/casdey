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

    // Narrowed 2026-08-23: the gym/fitness V1 is now going out to real
    // invited gyms for the free-trial/feedback loop, so /app and everything
    // it depends on (auth, booking, unsubscribe, legal pages, password
    // reset) must be reachable in production. Only the public marketing
    // homepage stays behind /waitlist for now — going fully public is a
    // separate, later decision. Locally (`next dev`) this block is skipped
    // entirely, so nothing changes for development. /api/* is untouched in
    // both cases. Reversible: to republish the homepage too, delete this
    // `unpublish` block; to re-gate everything, restore the fuller list.
    // Temporary (307/308) redirect, not permanent.
    const unpublish = [{ source: "/", destination: "/waitlist", permanent: false }];

    return process.env.NODE_ENV === "production"
      ? [...always, ...unpublish]
      : always;
  },
};

export default nextConfig;

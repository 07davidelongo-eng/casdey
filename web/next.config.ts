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

      // Temporary: casdey.com is unpublished down to just /waitlist while the
      // dental-to-fitness niche pivot is being decided (see CLAUDE.md, "Niche
      // pivot under consideration"). Everything else, marketing pages, the
      // SaaS product, login/auth, booking, unsubscribe, redirects there.
      // /privacy stays reachable since the waitlist form links to it, and
      // /api/* is untouched since none of it is browsable UI. Temporary
      // (307/308) redirects, not permanent, so this is a one-line revert:
      // delete this block once the site is ready to republish.
      { source: "/", destination: "/waitlist", permanent: false },
      { source: "/app", destination: "/waitlist", permanent: false },
      { source: "/app/:path*", destination: "/waitlist", permanent: false },
      { source: "/auth/:path*", destination: "/waitlist", permanent: false },
      { source: "/book/:path*", destination: "/waitlist", permanent: false },
      { source: "/login", destination: "/waitlist", permanent: false },
      {
        source: "/reset-password",
        destination: "/waitlist",
        permanent: false,
      },
      { source: "/terms/:path*", destination: "/waitlist", permanent: false },
      { source: "/u/:path*", destination: "/waitlist", permanent: false },
    ];
  },
};

export default nextConfig;

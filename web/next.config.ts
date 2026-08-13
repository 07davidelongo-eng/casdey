import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits on top of the page and lands in design
  // screenshots, which makes comparing passes harder than it needs to be.
  devIndicators: false,

  async redirects() {
    return [
      // The landing page lives at the root. /homepage is kept as an alias so a
      // link written that way still lands somewhere sensible.
      { source: "/homepage", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;

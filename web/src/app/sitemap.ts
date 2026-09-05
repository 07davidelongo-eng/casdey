import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // The homepage still redirects to /waitlist in production (see
  // next.config.ts redirects()), so it stays out of here: pointing a crawler
  // at a redirect is worse than not listing it. Everything else below
  // resolves, including /pricing, which is not covered by that redirect.
  return [
    { url: "https://casdey.com/waitlist", lastModified, priority: 1 },
    { url: "https://casdey.com/pricing", lastModified, priority: 0.8 },
    { url: "https://casdey.com/privacy", lastModified, priority: 0.3 },
  ];
}

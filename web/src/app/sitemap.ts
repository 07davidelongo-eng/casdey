import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // Temporary: the rest of the site redirects to /waitlist while the niche
  // pivot is being decided (see next.config.ts redirects()). Only list pages
  // that actually resolve, so search engines aren't pointed at a redirect.
  return [
    { url: "https://casdey.com/waitlist", lastModified, priority: 1 },
    { url: "https://casdey.com/privacy", lastModified, priority: 0.3 },
  ];
}

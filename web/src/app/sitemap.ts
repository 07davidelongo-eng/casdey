import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://casdey.com/", lastModified, priority: 1 },
    { url: "https://casdey.com/waitlist", lastModified, priority: 0.8 },
    { url: "https://casdey.com/privacy", lastModified, priority: 0.3 },
  ];
}

import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

const ROUTES = ["/pulse", "/sectors", "/indices", "/screener", "/news", "/institutional"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...ROUTES.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}

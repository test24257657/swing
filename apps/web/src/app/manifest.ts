import type { MetadataRoute } from "next";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Swing",
    description: SITE_TAGLINE,
    start_url: "/pulse",
    display: "standalone",
    background_color: "#f5f5f6",
    theme_color: "#7c3aed",
    lang: "en-IN",
    categories: ["finance", "productivity"],
  };
}

import type { Metadata } from "next";

/**
 * SEO helpers. Every route defines its metadata through `screenMetadata()` so titles,
 * descriptions, canonicals and Open Graph tags stay consistent.
 *
 * `NEXT_PUBLIC_SITE_URL` is the public origin (e.g. https://swing-terminal.vercel.app).
 * It drives `metadataBase`, canonical URLs and absolute OG image URLs.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const SITE_NAME = "Swing Terminal";
export const SITE_TAGLINE =
  "Swing & momentum screener for Indian equities (NSE) — sector rotation, chart-pattern setups, delivery and F&O confirmation.";

interface ScreenMeta {
  title: string;
  description: string;
  path: string;
  /** user-specific or data-thin pages should not be indexed */
  noindex?: boolean;
}

export function screenMetadata({ title, description, path, noindex }: ScreenMeta): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/shell/app-shell";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — NSE swing & momentum screener`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  keywords: [
    "NSE screener",
    "swing trading India",
    "momentum stocks NSE",
    "stock screener India",
    "sector rotation",
    "VCP screener",
    "52 week high breakout",
    "delivery percentage screener",
    "relative strength NSE",
  ],
  authors: [{ name: SITE_NAME }],
  category: "finance",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — NSE swing & momentum screener`,
    description: SITE_TAGLINE,
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — NSE swing & momentum screener`,
    description: SITE_TAGLINE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

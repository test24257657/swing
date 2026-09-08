import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/shell/app-shell";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Swing Terminal",
  description: "Swing/momentum screener for Indian equities (NSE).",
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

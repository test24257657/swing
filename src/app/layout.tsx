import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import TopLoader from "@/components/ui/top-loader";

export const metadata: Metadata = {
  title: "Swing Terminal — Indian Equities Momentum Workbench",
  description: "High-density institutional trading terminal for NSE & BSE Swing-to-Momentum Trading.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

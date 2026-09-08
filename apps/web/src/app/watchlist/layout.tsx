import { type ReactNode } from "react";

import { screenMetadata } from "@/lib/seo";

export const metadata = screenMetadata({
  title: "Watchlist",
  description: "Track swing candidates with entry, target, stop and score-since-added, plus alerts.",
  path: "/watchlist",
  noindex: true, // user-specific
});

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children;
}

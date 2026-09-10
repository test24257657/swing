import { screenMetadata } from "@/lib/seo";

import { WatchlistClient } from "./watchlist-client";

export const metadata = screenMetadata({
  title: "Watchlist",
  description: "Symbols you're tracking, with entry price, unrealised P/L, and EOD price alerts.",
  path: "/watchlist",
  noindex: true, // per-user data
});

export default function WatchlistPage() {
  return <WatchlistClient />;
}

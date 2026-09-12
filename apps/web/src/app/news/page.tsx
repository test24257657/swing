import { screenMetadata } from "@/lib/seo";

import { NewsClient } from "./news-client";

export const metadata = screenMetadata({
  title: "News",
  description:
    "NSE corporate announcements for movers, screener matches and your watchlist — filtered to what matters and classified by likely swing-trading impact.",
  path: "/news",
});

export default function NewsPage() {
  return <NewsClient />;
}

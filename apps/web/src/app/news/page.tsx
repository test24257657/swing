import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { screenMetadata } from "@/lib/seo";

export const metadata = screenMetadata({
  title: "News & Announcements",
  description:
    "NSE and BSE corporate filings classified by expected swing impact, with an AI impact summary per filing and watchlist and sector filters.",
  path: "/news",
});

export default function NewsPage() {
  return (
    <Screen>
      <ScreenHeader
        title="News &amp; announcements"
        subtitle="Exchange filings classified by expected swing impact."
      />
      <PhaseStub
        phase="Phase 7 · news"
        contents={[
          "Corporate announcements feed, date-grouped, with symbol + impact class",
          "AI impact summary per filing (nightly LLM pass, with a confidence score)",
          "Impact-class chips (Very Good … Very Poor) that double as filters",
          "Watchlist-only toggle and sector filter",
        ]}
      />
    </Screen>
  );
}

import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";

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

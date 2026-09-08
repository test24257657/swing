import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { screenMetadata } from "@/lib/seo";

export const metadata = screenMetadata({
  title: "Market Pulse",
  description:
    "Post-close read on the NSE: market breadth, FII/DII flows, India VIX regime, and the day's most-active and 52-week-high-breakout names.",
  path: "/pulse",
});

export default function PulsePage() {
  return (
    <Screen>
      <ScreenHeader
        title="Market Pulse"
        subtitle="Post-close read on breadth, flows and volatility."
      />
      <PhaseStub
        phase="Phase 6 · market context"
        contents={[
          "Index cards — NIFTY 50 / BANK NIFTY / SENSEX / INDIA VIX with 30d sparklines",
          "Market breadth donut (advances / declines / unchanged, A/D ratio)",
          "FII / DII flow — last 10 sessions, grouped bars",
          "Volatility regime gauge with a trend-friendliness verdict",
          "Most-active-by-value and 52-week-high-breakout tables → link into Screener",
        ]}
      />
    </Screen>
  );
}

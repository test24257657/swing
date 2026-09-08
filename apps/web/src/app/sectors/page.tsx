import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";

export default function SectorsPage() {
  return (
    <Screen>
      <ScreenHeader
        title="Sector Rotation"
        subtitle="Where capital is rotating, and which sectors have slipped."
      />
      <PhaseStub
        phase="Phase 6 · market context"
        contents={[
          "Treemap heatmap — cell size = free-float market cap, colour = timeframe return",
          "Ranked-by-momentum list with rank-change arrows vs 3 weeks ago",
          "Relative rotation graph (RRG) vs NIFTY 500 with 6-week tails",
          "Click any sector → Screener pre-filtered to that sector",
        ]}
      />
    </Screen>
  );
}

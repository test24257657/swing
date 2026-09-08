import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { screenMetadata } from "@/lib/seo";

export const metadata = screenMetadata({
  title: "Indices",
  description:
    "NSE indices — broad, sectoral, thematic and strategy — with OHLC, 1W/1M/3M returns, distance from 52-week high, advance/decline and a constituents breakdown.",
  path: "/indices",
});

export default function IndicesPage() {
  return (
    <Screen>
      <ScreenHeader title="Indices" subtitle="NSE indices — broad, sectoral, thematic, strategy." />
      <PhaseStub
        phase="Phase 6 · market context"
        contents={[
          "Dense index table — OHLC, 1W/1M/3M returns, distance from 52W high, A/D, sparkline",
          "Chart view — mini candle + volume cards with 20/50 DMA and S/R",
          "Constituents drawer — point contribution (weight × return) per stock",
        ]}
      />
    </Screen>
  );
}

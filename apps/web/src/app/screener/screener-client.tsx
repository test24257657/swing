"use client";

import { useMemo } from "react";

import { FilterRail } from "@/components/screener/filter-rail";
import { ScreenerList } from "@/components/screener/screener-list";
import { PhaseStub } from "@/components/screen/phase-stub";
import { ScreenHeader } from "@/components/screen/screen-header";
import { Segmented } from "@/components/ui";
import { useScreener } from "@/lib/api/hooks";
import type { ScreenerFacets } from "@/lib/api/types";
import { RESET_PARAMS, toApiParams, useScreenerParams } from "@/lib/url/screener-params";
import { useView } from "@/stores/view";

const EMPTY_FACETS: ScreenerFacets = { sectors: {}, verdicts: {}, patterns: {}, stages: {} };

export function ScreenerClient() {
  const [params, setParams] = useScreenerParams();
  const view = useView((s) => s.screenerView);
  const setView = useView((s) => s.setScreenerView);

  const apiParams = useMemo(() => toApiParams(params), [params]);
  const query = useScreener(apiParams);

  const result = query.data?.data;
  const subtitle = result
    ? `${result.total.toLocaleString("en-IN")} matches · sorted by ${params.sort}`
    : "Rank strong sectors, screen for setups, confirm and size.";

  return (
    <div className="flex items-stretch">
      <FilterRail
        params={params}
        setParams={setParams}
        reset={() => setParams(RESET_PARAMS)}
        facets={result?.facets ?? EMPTY_FACETS}
      />

      <div className="min-w-0 flex-1 px-6 pb-14 pt-6">
        <ScreenHeader
          title="Screener"
          subtitle={subtitle}
          actions={
            <Segmented
              options={[
                { value: "list", label: "List" },
                { value: "chart", label: "Chart" },
              ]}
              value={view}
              onChange={setView}
            />
          }
        />

        {view === "chart" ? (
          <PhaseStub
            phase="Phase 3 · charts"
            contents={[
              "2-col grid of annotated mini-charts (TradingView Lightweight Charts + an SVG overlay layer)",
              "Pattern-specific overlays — VCP contraction zones, IPO base, 52WH breakout box, pivot line",
              "20/50 DMA, support/resistance, and a 4-stat chip row per card",
            ]}
          />
        ) : (
          <ScreenerList
            query={query}
            params={params}
            setParams={setParams}
            onClearFilters={() => setParams(RESET_PARAMS)}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";

import { ChartGrid } from "@/components/screener/chart-grid";
import { FilterRail } from "@/components/screener/filter-rail";
import { ScreenerList } from "@/components/screener/screener-list";
import { ScreenHeader } from "@/components/screen/screen-header";
import { Segmented } from "@/components/ui";
import { useScreener } from "@/lib/api/hooks";
import type { ScreenerFacets } from "@/lib/api/types";
import { RESET_PARAMS, toApiParams, useScreenerParams } from "@/lib/url/screener-params";
import { useView } from "@/stores/view";

const EMPTY_FACETS: ScreenerFacets = { sectors: {}, verdicts: {}, patterns: {}, stages: {} };
const CHART_PER_PAGE = 10;

export function ScreenerClient() {
  const [params, setParams] = useScreenerParams();
  const view = useView((s) => s.screenerView);
  const setView = useView((s) => s.setScreenerView);

  const apiParams = useMemo(() => {
    const p = toApiParams(params);
    if (view === "chart") p.per_page = CHART_PER_PAGE;
    return p;
  }, [params, view]);
  const query = useScreener(apiParams);

  const result = query.data?.data;
  const perPage = view === "chart" ? CHART_PER_PAGE : params.per_page;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / perPage)) : 1;
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
          <ChartGrid
            query={query}
            page={params.page}
            totalPages={totalPages}
            onPage={(p) => setParams({ page: p })}
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

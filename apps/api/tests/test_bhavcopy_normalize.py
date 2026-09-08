from __future__ import annotations

from datetime import date

import pandas as pd

from app.ingestion.sources.nse_bhavcopy import normalize

# A trimmed sample of the nselib bhav_copy_with_delivery frame.
SAMPLE = pd.DataFrame(
    [
        {
            "SYMBOL": "TATAMOTORS",
            "SERIES": "EQ",
            "PREV_CLOSE": "995.85",
            "OPEN_PRICE": "997.00",
            "HIGH_PRICE": "1031.00",
            "LOW_PRICE": "996.00",
            "CLOSE_PRICE": "1024.35",
            "AVG_PRICE": "1016.80",
            "TTL_TRD_QNTY": "24,10,000",
            "TURNOVER_LACS": "24505.10",
            "NO_OF_TRADES": "180245",
            "DELIV_QTY": "17,11,000",
            "DELIV_PER": "71.00",
        },
        {  # index/derivative row that must be dropped
            "SYMBOL": "NIFTY",
            "SERIES": "--",
            "OPEN_PRICE": "0",
            "HIGH_PRICE": "0",
            "LOW_PRICE": "0",
            "CLOSE_PRICE": "0",
            "TTL_TRD_QNTY": "0",
        },
    ]
)


def test_normalize_maps_and_filters() -> None:
    rows = normalize(SAMPLE, date(2026, 9, 6))
    assert len(rows) == 1
    r = rows[0]
    assert r.nse_symbol == "TATAMOTORS"
    assert r.close == 1024.35
    assert r.volume == 2410000
    assert r.delivery_qty == 1711000
    assert r.delivery_pct == 71.0
    # turnover in lacs -> rupees
    assert r.turnover == 24505.10 * 1e5

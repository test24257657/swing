from __future__ import annotations

import pandas as pd


def test_panel_drops_a_holiday_stamped_with_the_previous_sessions_file():
    from jobs.panel import drop_phantom_sessions

    rows = []
    for day, closes in (("2026-09-10", (10, 20, 30)), ("2026-09-11", (11, 21, 31)),
                        ("2026-09-14", (11, 21, 31)), ("2026-09-15", (12, 22, 32))):
        for sym, c in zip("ABC", closes):
            rows.append({"date": pd.Timestamp(day), "symbol": sym, "close": float(c), "volume": c * 100})
    healed, dropped = drop_phantom_sessions(pd.DataFrame(rows))
    assert dropped == ["2026-09-14"]
    assert sorted(healed["date"].dt.strftime("%Y-%m-%d").unique()) == ["2026-09-10", "2026-09-11", "2026-09-15"]


def test_panel_keeps_real_sessions_even_when_a_few_stocks_are_unchanged():
    from jobs.panel import drop_phantom_sessions

    rows = []
    for day, closes in (("2026-09-10", (10, 20, 30)), ("2026-09-11", (10, 21, 31))):  # A unchanged
        for sym, c in zip("ABC", closes):
            rows.append({"date": pd.Timestamp(day), "symbol": sym, "close": float(c), "volume": 100})
    _, dropped = drop_phantom_sessions(pd.DataFrame(rows))
    assert dropped == []

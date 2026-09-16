from __future__ import annotations

from datetime import date

import pandas as pd

from jobs import sources


def test_recent_sessions_filled_from_daily_file_without_duplicates(monkeypatch):
    hist = pd.DataFrame({"date": pd.to_datetime(["2026-09-14", "2026-09-15"]), "close": [1.0, 2.0]})
    calls = []

    def fake(symbol, d):
        calls.append(d)
        return {"date": pd.Timestamp(d), "close": 3.0, "open": 3.0, "high": 3.0, "low": 3.0} if d == date(2026, 9, 16) else None

    monkeypatch.setattr(sources, "index_close_on", fake)
    out = sources._append_recent_closes("NIFTY 50", hist, date(2026, 9, 16))
    assert out["date"].dt.date.tolist() == [date(2026, 9, 14), date(2026, 9, 15), date(2026, 9, 16)]
    assert out["close"].iloc[-1] == 3.0
    assert calls == [date(2026, 9, 16)]  # only sessions after the last one we already have


def test_nothing_appended_when_history_is_current(monkeypatch):
    hist = pd.DataFrame({"date": pd.to_datetime(["2026-09-16"]), "close": [1.0]})
    monkeypatch.setattr(sources, "index_close_on", lambda s, d: (_ for _ in ()).throw(AssertionError("no fetch")))
    assert len(sources._append_recent_closes("NIFTY 50", hist, date(2026, 9, 16))) == 1

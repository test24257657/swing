from __future__ import annotations

# Canonical sector list for the screener's sector-rotation view. ``index_symbol`` is the
# NSE sectoral index used for relative-strength and rotation maths. Constituent mapping is
# attempted at ingest time; when it fails a symbol simply keeps ``sector_id = NULL``.
SECTORS: list[dict] = [
    {"name": "Automobile", "slug": "auto", "index_symbol": "NIFTY AUTO"},
    {"name": "Banking", "slug": "bank", "index_symbol": "NIFTY BANK"},
    {"name": "Capital Goods", "slug": "capital-goods", "index_symbol": "NIFTY CAPITAL MARKETS"},
    {"name": "Financial Services", "slug": "financial-services", "index_symbol": "NIFTY FINANCIAL SERVICES"},  # noqa: E501
    {"name": "FMCG", "slug": "fmcg", "index_symbol": "NIFTY FMCG"},
    {"name": "Healthcare", "slug": "healthcare", "index_symbol": "NIFTY HEALTHCARE INDEX"},
    {"name": "Information Technology", "slug": "it", "index_symbol": "NIFTY IT"},
    {"name": "Media", "slug": "media", "index_symbol": "NIFTY MEDIA"},
    {"name": "Metal", "slug": "metal", "index_symbol": "NIFTY METAL"},
    {"name": "Oil & Gas", "slug": "oil-gas", "index_symbol": "NIFTY OIL & GAS"},
    {"name": "Pharma", "slug": "pharma", "index_symbol": "NIFTY PHARMA"},
    {"name": "PSU Bank", "slug": "psu-bank", "index_symbol": "NIFTY PSU BANK"},
    {"name": "Private Bank", "slug": "private-bank", "index_symbol": "NIFTY PRIVATE BANK"},
    {"name": "Realty", "slug": "realty", "index_symbol": "NIFTY REALTY"},
    {"name": "Consumer Durables", "slug": "consumer-durables", "index_symbol": "NIFTY CONSUMER DURABLES"},  # noqa: E501
]

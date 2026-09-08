from __future__ import annotations

# Indices we track. Sectoral ones must line up with sectors_seed.py's index_symbol so the
# relative-strength leg of the score can read the matching sector index's closes.
# category: broad | sectoral | thematic | strategy
INDICES: list[dict] = [
    # Broad
    {"symbol": "NIFTY 50", "name": "Nifty 50", "category": "broad"},
    {"symbol": "NIFTY NEXT 50", "name": "Nifty Next 50", "category": "broad"},
    {"symbol": "NIFTY 100", "name": "Nifty 100", "category": "broad"},
    {"symbol": "NIFTY 200", "name": "Nifty 200", "category": "broad"},
    {"symbol": "NIFTY 500", "name": "Nifty 500", "category": "broad"},
    {"symbol": "NIFTY MIDCAP 150", "name": "Nifty Midcap 150", "category": "broad"},
    {"symbol": "NIFTY SMALLCAP 250", "name": "Nifty Smallcap 250", "category": "broad"},
    {"symbol": "INDIA VIX", "name": "India VIX", "category": "strategy"},
    # Sectoral — keep in sync with sectors_seed.py
    {"symbol": "NIFTY AUTO", "name": "Nifty Auto", "category": "sectoral"},
    {"symbol": "NIFTY BANK", "name": "Nifty Bank", "category": "sectoral"},
    {"symbol": "NIFTY FINANCIAL SERVICES", "name": "Nifty Financial Services", "category": "sectoral"},  # noqa: E501
    {"symbol": "NIFTY FMCG", "name": "Nifty FMCG", "category": "sectoral"},
    {"symbol": "NIFTY HEALTHCARE INDEX", "name": "Nifty Healthcare", "category": "sectoral"},
    {"symbol": "NIFTY IT", "name": "Nifty IT", "category": "sectoral"},
    {"symbol": "NIFTY MEDIA", "name": "Nifty Media", "category": "sectoral"},
    {"symbol": "NIFTY METAL", "name": "Nifty Metal", "category": "sectoral"},
    {"symbol": "NIFTY OIL & GAS", "name": "Nifty Oil & Gas", "category": "sectoral"},
    {"symbol": "NIFTY PHARMA", "name": "Nifty Pharma", "category": "sectoral"},
    {"symbol": "NIFTY PSU BANK", "name": "Nifty PSU Bank", "category": "sectoral"},
    {"symbol": "NIFTY PRIVATE BANK", "name": "Nifty Private Bank", "category": "sectoral"},
    {"symbol": "NIFTY REALTY", "name": "Nifty Realty", "category": "sectoral"},
    {"symbol": "NIFTY CONSUMER DURABLES", "name": "Nifty Consumer Durables", "category": "sectoral"},
]

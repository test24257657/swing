"""
pipeline/storage.py
GitHub Release Parquet reader/writer for ohlcv_2y.parquet.

The 2-year OHLCV history (~20 MB) lives as a GitHub Release asset (tag: latest-data).
This keeps it out of git history while making it freely accessible.

On each nightly run:
1. Download the existing parquet from the release
2. Append today's bars
3. Drop bars older than 2 years
4. Upload the updated parquet back to the release
"""

from __future__ import annotations

import io
import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import polars as pl

from pipeline.config import (
    GITHUB_REPO,
    GITHUB_TOKEN,
    LOCAL_PARQUET_PATH,
    PARQUET_ASSET_NAME,
    PARQUET_RELEASE_TAG,
    HISTORY_DAYS,
)

log = logging.getLogger("pipeline.storage")

_GH_API = "https://api.github.com"


def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def load_parquet() -> Optional[pl.DataFrame]:
    """
    Load ohlcv_2y.parquet from GitHub Release asset.

    Falls back to local cache if download fails.
    Returns None if no data is available at all.
    """
    # Try local cache first (same run, already downloaded)
    if LOCAL_PARQUET_PATH.exists():
        log.info("Loading parquet from local cache: %s", LOCAL_PARQUET_PATH)
        try:
            return pl.read_parquet(LOCAL_PARQUET_PATH)
        except Exception as exc:
            log.warning("Local parquet corrupt: %s — re-downloading", exc)
            LOCAL_PARQUET_PATH.unlink(missing_ok=True)

    # Download from GitHub Release
    try:
        asset_url = _get_asset_url(PARQUET_RELEASE_TAG, PARQUET_ASSET_NAME)
        if asset_url is None:
            log.warning("GitHub Release asset not found — will create on first upload")
            return None

        log.info("Downloading parquet from GitHub Release: %s", asset_url)
        content = _download_asset(asset_url)
        if content is None:
            return None

        LOCAL_PARQUET_PATH.write_bytes(content)
        df = pl.read_parquet(io.BytesIO(content))
        log.info("Parquet loaded: %d rows, %d stocks", len(df), df["isin"].n_unique())
        return df

    except Exception as exc:
        log.error("Failed to load parquet from GitHub Release: %s", exc)
        return None


def save_parquet(df: pl.DataFrame) -> bool:
    """
    Save the updated ohlcv_2y.parquet back to GitHub Release asset.

    1. Prune rows older than HISTORY_DAYS
    2. Write to local cache
    3. Upload to GitHub Release (replace existing asset)

    Returns True on success.
    """
    # Prune old rows
    cutoff = date.today() - timedelta(days=HISTORY_DAYS)
    before = len(df)
    df = df.filter(pl.col("date") >= pl.lit(cutoff))
    log.info("Pruned %d rows older than %s; %d rows remain", before - len(df), cutoff, len(df))

    # Clean up temporary or duplicate columns
    temp_cols = [c for c in df.columns if c.startswith("_") or c.endswith("_right")]
    if temp_cols:
        df = df.drop(temp_cols)

    # Sort for compressed storage
    df = df.sort(["isin", "date"])

    # Write local cache
    df.write_parquet(LOCAL_PARQUET_PATH, compression="snappy")
    log.info("Parquet written locally: %.1f MB", LOCAL_PARQUET_PATH.stat().st_size / 1e6)

    if not GITHUB_TOKEN or not GITHUB_REPO:
        log.warning("GITHUB_TOKEN / GITHUB_REPO not set — skipping upload")
        return False

    try:
        return _upload_asset(PARQUET_RELEASE_TAG, PARQUET_ASSET_NAME, LOCAL_PARQUET_PATH)
    except Exception as exc:
        log.error("Failed to upload parquet to GitHub Release: %s", exc)
        return False


def append_daily_bars(
    existing: Optional[pl.DataFrame],
    new_bars: pl.DataFrame,
) -> pl.DataFrame:
    """
    Append new_bars to existing parquet, deduplicating by (isin, date).

    new_bars must have columns:
        isin, symbol, exchange, date, open, high, low, close, volume,
        delivery_pct, adj_factor (default 1.0 if not present)
    """
    if "adj_factor" not in new_bars.columns:
        new_bars = new_bars.with_columns([
            pl.lit(1.0).alias("adj_factor"),
        ])

    if existing is None or len(existing) == 0:
        log.info("No existing parquet — starting fresh with %d new bars", len(new_bars))
        return new_bars

    # Dedup: remove any existing rows for dates in new_bars
    new_dates = new_bars["date"].unique().to_list()
    existing_trimmed = existing.filter(~pl.col("date").is_in(new_dates))

    combined = pl.concat([existing_trimmed, new_bars], how="diagonal")
    log.info(
        "Appended %d new bars. Total: %d rows for %d stocks",
        len(new_bars),
        len(combined),
        combined["isin"].n_unique(),
    )

    return combined


def apply_split_adjustments(df: pl.DataFrame, splits: list[dict]) -> pl.DataFrame:
    """
    Apply split/bonus adjustments to historical OHLCV.

    splits: list of {isin, ex_date, adj_factor}
    For each split, multiply close/open/high/low by adj_factor for all rows
    with date < ex_date.
    """
    for split in splits:
        isin = split["isin"]
        ex_date = split["ex_date"]
        factor = split["adj_factor"]

        if factor == 1.0:
            continue

        log.info("Applying split for %s: factor=%.4f, ex_date=%s", isin, factor, ex_date)

        df = df.with_columns([
            pl.when(
                (pl.col("isin") == isin) & (pl.col("date") < pl.lit(ex_date))
            )
            .then(pl.col("open") * factor)
            .otherwise(pl.col("open"))
            .alias("open"),

            pl.when(
                (pl.col("isin") == isin) & (pl.col("date") < pl.lit(ex_date))
            )
            .then(pl.col("high") * factor)
            .otherwise(pl.col("high"))
            .alias("high"),

            pl.when(
                (pl.col("isin") == isin) & (pl.col("date") < pl.lit(ex_date))
            )
            .then(pl.col("low") * factor)
            .otherwise(pl.col("low"))
            .alias("low"),

            pl.when(
                (pl.col("isin") == isin) & (pl.col("date") < pl.lit(ex_date))
            )
            .then(pl.col("close") * factor)
            .otherwise(pl.col("close"))
            .alias("close"),

            pl.when(
                (pl.col("isin") == isin) & (pl.col("date") < pl.lit(ex_date))
            )
            .then(pl.col("volume") / factor)
            .otherwise(pl.col("volume"))
            .alias("volume"),
        ])

    return df


# ─── GitHub Release API helpers ───────────────────────────────────────────────

def _get_release_id(tag: str) -> Optional[int]:
    """Get GitHub Release ID by tag. Creates the release if it doesn't exist."""
    import urllib.request
    import urllib.error

    url = f"{_GH_API}/repos/{GITHUB_REPO}/releases/tags/{tag}"
    req = urllib.request.Request(url, headers=_gh_headers())

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
            return data["id"]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return _create_release(tag)
        raise


def _create_release(tag: str) -> int:
    """Create a GitHub Release with the given tag."""
    import urllib.request

    payload = json.dumps({
        "tag_name": tag,
        "name": "Latest Pipeline Data",
        "body": "Auto-managed by Swing Terminal v2 nightly pipeline.",
        "draft": False,
        "prerelease": False,
    }).encode()

    url = f"{_GH_API}/repos/{GITHUB_REPO}/releases"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={**_gh_headers(), "Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
        log.info("Created GitHub Release: %s (id=%d)", tag, data["id"])
        return data["id"]


def _get_asset_url(tag: str, asset_name: str) -> Optional[str]:
    """Get the download URL of a release asset."""
    import urllib.request
    import urllib.error

    url = f"{_GH_API}/repos/{GITHUB_REPO}/releases/tags/{tag}"
    req = urllib.request.Request(url, headers=_gh_headers())

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
            for asset in data.get("assets", []):
                if asset["name"] == asset_name:
                    return asset["browser_download_url"]
        return None
    except Exception:
        return None


def _download_asset(url: str) -> Optional[bytes]:
    """Download a GitHub Release asset (handles redirect to S3)."""
    import urllib.request

    req = urllib.request.Request(
        url,
        headers={
            **_gh_headers(),
            "Accept": "application/octet-stream",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except Exception as exc:
        log.error("Asset download failed: %s", exc)
        return None


def _upload_asset(tag: str, asset_name: str, file_path: Path) -> bool:
    """Upload (or replace) a release asset."""
    import urllib.request
    import urllib.error

    release_id = _get_release_id(tag)
    if release_id is None:
        log.error("Could not get/create release for tag: %s", tag)
        return False

    # Delete existing asset with same name first
    _delete_asset_if_exists(release_id, asset_name)

    # Upload new asset
    upload_url = (
        f"https://uploads.github.com/repos/{GITHUB_REPO}"
        f"/releases/{release_id}/assets?name={asset_name}"
    )

    content = file_path.read_bytes()
    req = urllib.request.Request(
        upload_url,
        data=content,
        headers={
            **_gh_headers(),
            "Content-Type": "application/octet-stream",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read())
            log.info(
                "Parquet uploaded to GitHub Release: %s (%.1f MB)",
                result.get("name"),
                result.get("size", 0) / 1e6,
            )
            return True
    except Exception as exc:
        log.error("Asset upload failed: %s", exc)
        return False


def _delete_asset_if_exists(release_id: int, asset_name: str) -> None:
    """Delete a release asset by name if it exists."""
    import urllib.request
    import urllib.error

    list_url = f"{_GH_API}/repos/{GITHUB_REPO}/releases/{release_id}/assets"
    req = urllib.request.Request(list_url, headers=_gh_headers())

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            assets = json.loads(resp.read())

        for asset in assets:
            if asset["name"] == asset_name:
                del_url = f"{_GH_API}/repos/{GITHUB_REPO}/releases/assets/{asset['id']}"
                del_req = urllib.request.Request(
                    del_url,
                    headers=_gh_headers(),
                    method="DELETE",
                )
                with urllib.request.urlopen(del_req, timeout=20) as _:
                    log.info("Deleted existing asset: %s", asset_name)
    except Exception as exc:
        log.warning("Could not delete existing asset: %s", exc)

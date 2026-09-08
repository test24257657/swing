from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    """Provenance and freshness for a payload. The frontend renders this on every panel:
    a ``source:`` line, an IST timestamp, and an amber treatment when ``stale`` is true."""

    source: str = Field(description="Human-readable origin, e.g. 'NSE bhavcopy'")
    as_of: datetime | None = Field(
        default=None, description="When the underlying data was last valid (IST)"
    )
    stale: bool = Field(default=False, description="True when the latest ingestion is behind schedule")
    job: str | None = Field(default=None, description="Ingestion job that produced this data")


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


def envelope(data: T, meta: Meta) -> Envelope[T]:
    return Envelope[T](data=data, meta=meta)

from __future__ import annotations

import redis

from app.config import settings

# Redis is used for exactly one thing in this architecture: live quotes with a short TTL.
# Everything else is precomputed and served from Postgres.
client: redis.Redis = redis.from_url(settings.redis_url, decode_responses=True)


def ping() -> bool:
    try:
        return bool(client.ping())
    except redis.RedisError:
        return False

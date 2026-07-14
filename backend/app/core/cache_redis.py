import inspect
import json
import os
from typing import Any, Callable

import redis.asyncio as redis

from app.utils.logger import get_logger

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)

logger = get_logger()

async def check_redis():
    try:
        await redis_client.ping()
        return True
    except Exception as e:
        logger.error(f"Error while checking redis: {e}")
        return False


async def get_json_cached(key: str) -> Any | None:
    data = await redis_client.get(key)
    if data is None:
        return None
    return json.loads(data)


async def set_json_cached(key: str, value: Any, ttl_seconds: int | None = 3600) -> None:
    payload = json.dumps(value)
    if ttl_seconds is None:
        await redis_client.set(key, payload)
        return
    await redis_client.set(key, payload, ex=ttl_seconds)


async def get_or_load_json_cached(
    key: str,
    loader: Callable[[], Any],
    ttl_seconds: int | None = 3600,
) -> Any:
    try:
        cached = await get_json_cached(key)
        if cached is not None:
            return cached
    except Exception as exc:
        logger.warning(f"Redis read failed for {key}: {exc}")

    loaded = loader()
    if inspect.isawaitable(loaded):
        loaded = await loaded

    try:
        await set_json_cached(key, loaded, ttl_seconds=ttl_seconds)
    except Exception as exc:
        logger.warning(f"Redis write failed for {key}: {exc}")

    return loaded

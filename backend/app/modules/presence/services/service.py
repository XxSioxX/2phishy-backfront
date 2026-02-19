from app.core.cache_redis import redis_client as redis

PRESENCE_TTL = 60  # seconds


async def mark_user_online(user_id: str):
    key = f"presence:user:{user_id}"
    await redis.set(key, "1", ex=PRESENCE_TTL)


async def is_user_online(user_id: str) -> bool:
    key = f"presence:user:{user_id}"
    exists = await redis.exists(key)
    return exists == 1


async def get_online_users(user_ids: list[str]) -> dict:

    pipeline = redis.pipeline()

    for uid in user_ids:
        pipeline.exists(f"presence:user:{uid}")

    results = await pipeline.execute()

    return {
        user_ids[i]: results[i] == 1
        for i in range(len(user_ids))
    }

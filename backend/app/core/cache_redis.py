import redis.asyncio as redis
import os

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)



async def check_redis():
    try:
        await redis_client.ping()
        return True
    except Exception:
        return False

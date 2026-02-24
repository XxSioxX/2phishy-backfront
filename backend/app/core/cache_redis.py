import redis.asyncio as redis
import os

from app.modules.reports.services import logger
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

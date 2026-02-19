import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.utils.logger import get_logger
import logging  # standard logging module

logging.getLogger("pymongo").setLevel(logging.WARNING)  # suppress DEBUG logs from pymongo

load_dotenv()

logger = get_logger(__name__)

MONGO_USER = os.getenv("MONGO_USER")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_HOST = os.getenv("MONGO_HOST", "mongo")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "phishy_game")

if not MONGO_USER or not MONGO_PASSWORD:
    raise RuntimeError("Mongo credentials missing! Set MONGO_USER and MONGO_PASSWORD.")

DATABASE_MONGO_URL = (
    f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}"
    f"@{MONGO_HOST}:{MONGO_PORT}/"
    "?authSource=admin"
)

logger.info(f"Mongo db url loaded")




logger.info("Database URL successfully loaded")

client = AsyncIOMotorClient(DATABASE_MONGO_URL)
db = client[MONGO_DB_NAME]

async def verify_mongo_connection():
    logger.info("Verifying MongoDB connection")

    try:
        await client.admin.command("ping")
        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


def get_mongo_db():
    return db
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.utils.logger import get_logger
import logging  # standard logging module

logging.getLogger("pymongo").setLevel(logging.WARNING)  # suppress DEBUG logs from pymongo

load_dotenv()

logger = get_logger(__name__)

DATABASE_MONGO_URL = os.getenv("DATABASE_MONGO_URL")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
logger.info(f"Mongo db url loaded")



if not DATABASE_MONGO_URL:
    logger.warning("DATABASE_MONGO_URL is not set in the environment variables! Using default MongoDB connection.")
    DATABASE_MONGO_URL = "mongodb://localhost:27017"
    MONGO_DB_NAME = "phishy_game"

logger.info("Database URL successfully loaded")

client = AsyncIOMotorClient(DATABASE_MONGO_URL)
db = client[MONGO_DB_NAME]

def verify_mongo_connection():
    logger.info("Verifying MongoDB connection")

    try:
        client.admin.command("ping")
        logger.info("Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

def get_mongo_db():
    return db
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from dotenv import load_dotenv
from app.utils.logger import get_logger

# Load environment variables
load_dotenv()

# Initialize logger
logger = get_logger("database.py")

# Get database URL securely
DATABASE_URL = os.getenv("DATABASE_URL")

# Use SQLite as fallback for development
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./phishy.db"
    logger.info("No DATABASE_URL found, using SQLite fallback")
else:
    logger.info(f"Loading Database URL: {DATABASE_URL}")

logger.info("Database URL successfully loaded")
# Create engine
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    logger.info("Database engine created successfully")
except Exception as e:
    logger.error(f"Failed to create database engine: {e}")
    raise

# Session factory
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Base class for models
Base = declarative_base()

# Dependency for DB sessions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Import all models here so they are registered with Base
    # This import must be inside the function to avoid circular imports
    from app.modules.user.models.user import User
    from app.modules.learning_path.models.learn_path import UserLearnPath
    from app.modules.game.models.game import GameProgress, GameScore

    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created successfully.")

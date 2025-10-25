from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

from app.utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

DATABASE_URL = os.getenv("DATABASE_POSTGRES_URL")

if not DATABASE_URL:
    logger.critical("DATABASE_URL is not set in the environment variables!")
    raise ValueError("DATABASE_URL is missing")

logger.info("Database URL successfully loaded")

# Create engine and session
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
logger.info("Connected to PostgreSQL successfully")

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.modules.user.models.user import User
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully.")

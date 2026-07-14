from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from app.utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

DATABASE_URL = os.getenv("DATABASE_POSTGRES_URL")

if not DATABASE_URL:
    logger.warning("DATABASE_POSTGRES_URL is not set in the environment variables! Using default PostgreSQL connection.")
    DATABASE_URL = "postgresql://admin:secret@phishy-postgres:5432/phishy_db"

logger.info("Database URL successfully loaded")

# Create engine with pool_pre_ping for connection health
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
logger.info("Connected to PostgreSQL successfully")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db():
    logger.info("Initializing database tables")
    try:
        # Import all models here to register them with Base
        from app.modules.user.models.user import User
        from app.modules.posts.models.post import Post
        from app.modules.auth.models.models import PasswordResetToken
        
        Base.metadata.create_all(bind=engine)
        _ensure_user_consent_columns()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

def _ensure_user_consent_columns():
    """Keep existing deployments compatible with consent fields added after table creation."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS thesis_consent_accepted BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS thesis_consent_accepted_at TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version VARCHAR NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR NULL",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

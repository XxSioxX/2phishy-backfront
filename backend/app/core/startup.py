import os
from sqlalchemy.orm import Session
from app.core.database_postgres import SessionLocal
from app.modules.user.models.user import UserRole
from app.modules.user.schemas.schemas import UserCreate
from app.modules.user.services.services import create_user, super_admin_exists
from app.utils.logger import get_logger

logger = get_logger("startup")

def startup_super_admin():
    db: Session = SessionLocal()

    try:
        logger.info("Checking for existing super admin...")

        if super_admin_exists(db):
            logger.info("Super admin already exists. Skipping seed.")
            return

        username = os.getenv("SUPER_ADMIN_USERNAME")
        email = os.getenv("SUPER_ADMIN_EMAIL")
        password = os.getenv("SUPER_ADMIN_PASSWORD")

        if not username or not email or not password:
            logger.warning("SUPER_ADMIN environment variables not set. Skipping seed.")
            return

        logger.info("No super admin found. Creating one...")

        user_data = UserCreate(
            username=username,
            email=email,
            password=password,
            role=UserRole.SUPER_ADMIN
        )

        create_user(db, user_data)

        logger.info("Super admin created successfully.")

    except Exception as e:
        logger.error(f"Error seeding super admin: {str(e)}")
        db.rollback()
    finally:
        db.close()

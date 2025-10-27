from sqlalchemy import Column, String, DateTime, Enum
from datetime import datetime
import uuid
from app.core.database import Base
from enum import Enum as PyEnum

class AccountStatus(PyEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class UserRole(PyEnum):
    STUDENT = "student"
    ADMIN = "admin"
    SUPER_ADMIN = "super-admin"

class User(Base):
    __tablename__ = "users"

    userid = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    account_status = Column(Enum(AccountStatus), default=AccountStatus.ACTIVE)
    role = Column(Enum(UserRole), default=UserRole.STUDENT)

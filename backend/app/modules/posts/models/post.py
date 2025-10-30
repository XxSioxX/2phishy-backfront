from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database_postgres import Base
from enum import Enum as PyEnum


class PostStatus(PyEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class PostCategory(PyEnum):
    ANNOUNCEMENT = "announcement"
    TUTORIAL = "tutorial"
    UPDATE = "update"
    GENERAL = "general"


class Post(Base):
    __tablename__ = "posts"

    post_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    status = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True) 
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)

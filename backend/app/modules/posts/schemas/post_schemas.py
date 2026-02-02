from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class PostCreate(BaseModel):
    title: str
    topic: str
    status: str = "draft"
    content: str = ""
    admin_notes: str = ""


class PostUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None
    status: str | None = None
    content: str | None = None
    admin_notes: str | None = None


class PostResponse(BaseModel):
    post_id: UUID
    title: str
    category: str
    status: str
    content: str
    admin_notes: str | None = None
    created_at: datetime
    updated_at: datetime
    created_by: str  # Changed to string to hold username or "ADMIN"
    created_by_role: str  # Role of the creator

    class Config:
        from_attributes = True

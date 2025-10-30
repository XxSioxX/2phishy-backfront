from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class PostCreate(BaseModel):
    title: str
    category: str
    status: str = "draft"
    content: str = ""
    admin_notes: str = ""


class PostUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
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
    created_by: UUID

    class Config:
        from_attributes = True

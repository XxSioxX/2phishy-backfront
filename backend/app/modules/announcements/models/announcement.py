from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId


class AnnouncementBase(BaseModel):
    title: str
    content: str
    isPublished: bool = False
    date: Optional[str] = None
    lastEditedBy: str
    lastEditedDate: str


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    isPublished: Optional[bool] = None
    lastEditedBy: str
    lastEditedDate: str


class AnnouncementResponse(AnnouncementBase):
    id: str = Field(alias="_id")
    createdAt: datetime
    updatedAt: datetime

    class Config:
        populate_by_name = True

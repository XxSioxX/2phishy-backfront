from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReportBase(BaseModel):
    message: str
    type: str  # Bug, Exploit, Behavior
    status: Optional[str] = None  # High, Mid, Low
    resolved: bool = False


class ReportCreate(ReportBase):
    studentId: str
    date: Optional[str] = None


class ReportUpdate(BaseModel):
    message: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    resolved: Optional[bool] = None


class ReportResponse(ReportBase):
    id: str = Field(alias="_id")
    studentId: str
    username: str
    date: str
    createdAt: datetime
    updatedAt: datetime
    resolvedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True

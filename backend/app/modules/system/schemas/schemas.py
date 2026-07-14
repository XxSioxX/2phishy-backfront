from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


ContentType = Literal["knowledge_base", "question_base", "initial_assessment"]


class SystemSettingsUpdate(BaseModel):
    system_name: Optional[str] = Field(default=None, max_length=120)
    institution_name: Optional[str] = Field(default=None, max_length=160)
    logo_url: Optional[str] = None
    login_subtitle: Optional[str] = Field(default=None, max_length=240)
    register_subtitle: Optional[str] = Field(default=None, max_length=240)
    privacy_summary: Optional[str] = Field(default=None, max_length=900)
    consent_text: Optional[str] = Field(default=None, max_length=900)


class SystemSettingsResponse(BaseModel):
    system_name: str
    institution_name: str
    logo_url: str
    login_subtitle: str
    register_subtitle: str
    privacy_summary: str
    consent_text: str
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class ContentDraftUpdate(BaseModel):
    data: Any


class ContentPublishRequest(BaseModel):
    data: Optional[Any] = None


class ContentResponse(BaseModel):
    content_type: ContentType
    label: str
    data: Any
    source: str
    draft_version: int
    published_version: int
    has_draft: bool
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


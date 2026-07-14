from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

from app.modules.user.models.user import UserRole, AccountStatus


class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.STUDENT  # default role
    privacy_policy_accepted: bool = False
    thesis_consent_accepted: bool = False
    consent_version: str | None = None

class UserLogin(BaseModel):
    username: str
    password: str
class UserResponse(UserBase):
    userid: UUID
    created_at: datetime
    last_login: datetime | None
    last_seen: datetime | None
    avatar_url: str | None = None
    role: UserRole
    account_status: AccountStatus
    privacy_policy_accepted: bool = False
    privacy_policy_accepted_at: datetime | None = None
    thesis_consent_accepted: bool = False
    thesis_consent_accepted_at: datetime | None = None
    consent_version: str | None = None

    class Config:
        from_attributes = True

# added

class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    account_status: AccountStatus | None = None
    role: UserRole | None = None

class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str
    message: str

class AdminUserResponse(UserResponse):
    pass

class UserStatsResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    suspended_users: int
    students: int
    admins: int
    super_admins: int

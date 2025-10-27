from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from app.modules.user.models.user import UserRole, AccountStatus

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.STUDENT  # Default role for new users

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    userid: UUID
    created_at: datetime
    last_login: datetime | None
    account_status: AccountStatus
    role: UserRole

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    account_status: AccountStatus | None = None
    role: UserRole | None = None

class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str
    message: str

class AdminUserResponse(UserResponse):
    """Extended user response for admin operations"""
    pass

class UserStatsResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    suspended_users: int
    students: int
    admins: int
    super_admins: int

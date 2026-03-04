from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database_postgres import get_db
from app.modules.user.models.user import User, AccountStatus
from app.utils.logger import get_logger
import os

try:
    from app.modules.email.services.service import EmailService
except (ImportError, RuntimeError):
    EmailService = None

from app.modules.auth.models.models import PasswordResetToken
import secrets
import hashlib
from datetime import datetime, timedelta
from app.core.cache_redis import redis_client as redis
from app.core.security import create_access_token, verify_token
from app.core.config import settings
import bcrypt

logger = get_logger("auth.py")

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "2phishy-production-perez-amarillento-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# JWT token scheme
security = HTTPBearer()

# Initialize email service lazily
_email_service = None

def get_email_service():
    """Get or create email service instance"""
    global _email_service
    if _email_service is None and EmailService is not None:
        _email_service = EmailService()
    return _email_service

def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Get user by ID (moved here to avoid circular import)"""
    return db.query(User).filter(User.userid == user_id).first()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        user_id = verify_token(token)
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user"""
    if current_user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(required_roles):
    """Dependency factory for role-based access control"""
    # Handle both string and list inputs
    if isinstance(required_roles, str):
        required_roles = [required_roles]
    
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # Check if user's role is in the allowed roles
        if current_user.role.value not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(required_roles)}"
            )
        return current_user
    return role_checker

def require_admin_role(current_user: User = Depends(get_current_active_user)) -> User:
    """Require admin or super-admin role"""
    if current_user.role.value not in ["admin", "super-admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin role required"
        )
    return current_user

def require_super_admin_role(current_user: User = Depends(get_current_active_user)) -> User:
    """Require super-admin role"""
    if current_user.role.value != "super-admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super admin role required"
        )
    return current_user

def get_current_user_role(current_user: User = Depends(get_current_active_user)) -> str:
    """Get current user's role"""
    return current_user.role.value

def generate_reset_token():
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    expires_at = datetime.utcnow() + timedelta(minutes=15)

    return raw_token, token_hash, expires_at


def forgot_password(db, user):

    raw_token, token_hash, expires_at = generate_reset_token()

    reset_entry = PasswordResetToken(
        user_id=user.userid,
        token_hash=token_hash,
        expires_at=expires_at
    )

    db.add(reset_entry)
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

    # Send email if email service is available
    email_service = get_email_service()
    if email_service:
        try:
            email_service.send_password_reset(user.email, reset_link)
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
    else:
        logger.warning("Email service not available. Password reset link not sent via email.")
        logger.info(f"Reset link: {reset_link}")

def reset_password(db: Session, raw_token: str, new_password: str):

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    reset_entry = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()

    if not reset_entry:
        return False

    user = db.query(User).filter(
        User.userid == reset_entry.user_id
    ).first()

    if not user:
        return False

    # hash new password
    hashed_password = bcrypt.hashpw(
        new_password.encode(),
        bcrypt.gensalt()
    ).decode()

    user.password = hashed_password
    reset_entry.used = True

    db.commit()

    return True


RESET_EMAIL_LIMIT = 3
RESET_EMAIL_WINDOW = 3600  # 1 hour

RESET_IP_LIMIT = 10
RESET_IP_WINDOW = 3600


async def check_reset_throttle(email: str, ip: str):

    email_key = f"rate:reset:email:{email.lower()}"
    ip_key = f"rate:reset:ip:{ip}"

    # Use pipeline for atomic-like behavior
    pipe = redis.pipeline()

    pipe.incr(email_key)
    pipe.expire(email_key, RESET_EMAIL_WINDOW)

    pipe.incr(ip_key)
    pipe.expire(ip_key, RESET_IP_WINDOW)

    email_count, _, ip_count, _ = await pipe.execute()

    if email_count > RESET_EMAIL_LIMIT:
        raise Exception("Too many password reset attempts for this email. Try again later.")

    if ip_count > RESET_IP_LIMIT:
        raise Exception("Too many password reset attempts from this IP. Try again later.")
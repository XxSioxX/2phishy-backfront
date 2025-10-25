from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.user.models.user import User, AccountStatus
from app.utils.logger import get_logger
import os

logger = get_logger("auth.py")

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# JWT token scheme
security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[str]:
    """Verify a JWT token and return the user ID"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None

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

def require_role(required_role: str):
    """Dependency factory for role-based access control"""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # Define role hierarchy: super-admin > admin > student
        role_hierarchy = {
            "student": 1,
            "admin": 2, 
            "super-admin": 3
        }
        
        current_role_level = role_hierarchy.get(current_user.role.value, 0)
        required_role_level = role_hierarchy.get(required_role, 0)
        
        # Allow access if user has required role or higher privilege
        if current_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}"
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
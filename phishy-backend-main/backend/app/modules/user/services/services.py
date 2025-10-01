from sqlalchemy.orm import Session
from sqlalchemy import func
from app.modules.user.models.user import User, UserRole, AccountStatus
from app.modules.user.schemas.schemas import UserCreate, UserLogin, UserUpdate, UserStatsResponse
from app.utils.logger import get_logger
from app.utils.password import get_password_hash, verify_password
from app.core.auth import create_access_token
from datetime import datetime, timedelta

logger = get_logger("user-services.py")

def create_user(db: Session, user_data: UserCreate):
    logger.info("Creating User")
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username, 
        email=user_data.email, 
        password=hashed_password,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"User created: {new_user.username} with role: {new_user.role.value}")
    return new_user

def get_user(db: Session, user_id: str):
    logger.info("Retrieving User")

    return db.query(User).filter(User.userid == user_id).first()

def get_all_users(db: Session):
    logger.info("Retrieving all Users")

    return db.query(User).all()

def update_user(db: Session, user_id: str, update_data: dict):
    logger.info("Updating User")

    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        return None
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

def delete_user(db: Session, user_id: str):
    logger.info("Deleting User")

    user = db.query(User).filter(User.userid == user_id).first()
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

def authenticate_user(db: Session, login_data: UserLogin):
    logger.info("Authenticating User")
    
    # Find user by username
    user = db.query(User).filter(User.username == login_data.username).first()
    
    if not user:
        logger.warning(f"User not found: {login_data.username}")
        return None
    
    # Check password
    if not verify_password(login_data.password, user.password):
        logger.warning(f"Invalid password for user: {login_data.username}")
        return None
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    logger.info(f"User authenticated successfully: {user.username}")
    return user

def create_user_token(user: User):
    """Create access token for user"""
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.userid}, expires_delta=access_token_expires
    )
    return access_token

# Admin service functions
def update_user_role(db: Session, user_id: str, new_role: UserRole, admin_user: User):
    """Update user role (admin function)"""
    logger.info(f"Admin {admin_user.username} updating user {user_id} role to {new_role.value}")
    
    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        return None
    
    # Prevent non-super-admins from creating super-admins
    if new_role == UserRole.SUPER_ADMIN and admin_user.role != UserRole.SUPER_ADMIN:
        raise ValueError("Only super-admins can create other super-admins")
    
    # Prevent users from changing their own role
    if user.userid == admin_user.userid:
        raise ValueError("Users cannot change their own role")
    
    user.role = new_role
    db.commit()
    db.refresh(user)
    logger.info(f"User {user.username} role updated to {user.role.value}")
    return user

def update_user_status(db: Session, user_id: str, new_status: AccountStatus, admin_user: User):
    """Update user account status (admin function)"""
    logger.info(f"Admin {admin_user.username} updating user {user_id} status to {new_status.value}")
    
    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        return None
    
    # Prevent users from changing their own status
    if user.userid == admin_user.userid:
        raise ValueError("Users cannot change their own account status")
    
    user.account_status = new_status
    db.commit()
    db.refresh(user)
    logger.info(f"User {user.username} status updated to {user.account_status.value}")
    return user

def get_user_statistics(db: Session):
    """Get user statistics for admin dashboard"""
    logger.info("Retrieving user statistics")
    
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.account_status == AccountStatus.ACTIVE).count()
    inactive_users = db.query(User).filter(User.account_status == AccountStatus.INACTIVE).count()
    suspended_users = db.query(User).filter(User.account_status == AccountStatus.SUSPENDED).count()
    students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    admins = db.query(User).filter(User.role == UserRole.ADMIN).count()
    super_admins = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).count()
    
    return UserStatsResponse(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        suspended_users=suspended_users,
        students=students,
        admins=admins,
        super_admins=super_admins
    )

def get_users_by_role(db: Session, role: UserRole):
    """Get all users with a specific role"""
    logger.info(f"Retrieving users with role: {role.value}")
    return db.query(User).filter(User.role == role).all()

def get_users_by_status(db: Session, status: AccountStatus):
    """Get all users with a specific account status"""
    logger.info(f"Retrieving users with status: {status.value}")
    return db.query(User).filter(User.account_status == status).all()

def admin_update_user(db: Session, user_id: str, update_data: UserUpdate, admin_user: User):
    """Admin function to update user information"""
    logger.info(f"Admin {admin_user.username} updating user {user_id}")
    
    user = db.query(User).filter(User.userid == user_id).first()
    if not user:
        return None
    
    # Prevent users from updating their own role or status
    if user.userid == admin_user.userid:
        if update_data.role is not None or update_data.account_status is not None:
            raise ValueError("Users cannot change their own role or account status")
    
    # Prevent non-super-admins from creating super-admins
    if update_data.role == UserRole.SUPER_ADMIN and admin_user.role != UserRole.SUPER_ADMIN:
        raise ValueError("Only super-admins can create other super-admins")
    
    # Update fields
    for field, value in update_data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    logger.info(f"User {user.username} updated by admin {admin_user.username}")
    return user

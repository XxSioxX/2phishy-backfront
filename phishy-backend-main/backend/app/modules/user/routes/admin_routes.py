from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_admin_role, require_super_admin_role, get_current_user_role
from app.modules.user.schemas.schemas import (
    UserResponse, UserUpdate, UserStatsResponse, AdminUserResponse
)
from app.modules.user.services.services import (
    get_all_users, get_user, admin_update_user, update_user_role, 
    update_user_status, get_user_statistics, get_users_by_role, 
    get_users_by_status, delete_user
)
from app.modules.user.models.user import User, UserRole, AccountStatus
from app.utils.logger import get_logger

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger("admin-routes.py")

@router.get("/stats", response_model=UserStatsResponse)
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get user statistics for admin dashboard"""
    logger.info(f"Admin {current_user.username} requesting user statistics")
    return get_user_statistics(db)

@router.get("/users", response_model=list[AdminUserResponse])
def get_all_users_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get all users (admin only)"""
    logger.info(f"Admin {current_user.username} requesting all users")
    return get_all_users(db)

@router.get("/users/role/{role}", response_model=list[AdminUserResponse])
def get_users_by_role_admin(
    role: UserRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get users by role (admin only)"""
    logger.info(f"Admin {current_user.username} requesting users with role: {role.value}")
    return get_users_by_role(db, role)

@router.get("/users/status/{status}", response_model=list[AdminUserResponse])
def get_users_by_status_admin(
    status: AccountStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get users by account status (admin only)"""
    logger.info(f"Admin {current_user.username} requesting users with status: {status.value}")
    return get_users_by_status(db, status)

@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get specific user details (admin only)"""
    logger.info(f"Admin {current_user.username} requesting user: {user_id}")
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user_admin(
    user_id: str,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Update user information (admin only)"""
    logger.info(f"Admin {current_user.username} updating user: {user_id}")
    try:
        user = admin_update_user(db, user_id, update_data, current_user)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/users/{user_id}/role/{new_role}", response_model=AdminUserResponse)
def change_user_role(
    user_id: str,
    new_role: UserRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Change user role (admin only)"""
    logger.info(f"Admin {current_user.username} changing user {user_id} role to {new_role.value}")
    try:
        user = update_user_role(db, user_id, new_role, current_user)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/users/{user_id}/status/{new_status}", response_model=AdminUserResponse)
def change_user_status(
    user_id: str,
    new_status: AccountStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Change user account status (admin only)"""
    logger.info(f"Admin {current_user.username} changing user {user_id} status to {new_status.value}")
    try:
        user = update_user_status(db, user_id, new_status, current_user)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/users/{user_id}")
def delete_user_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Delete user (admin only)"""
    logger.info(f"Admin {current_user.username} deleting user: {user_id}")
    
    # Prevent users from deleting themselves
    if user_id == current_user.userid:
        raise HTTPException(status_code=400, detail="Users cannot delete their own account")
    
    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@router.get("/my-role")
def get_my_admin_role(current_user: User = Depends(require_admin_role)):
    """Get current admin's role"""
    logger.info(f"Admin {current_user.username} requesting their role")
    return {
        "user_id": current_user.userid,
        "username": current_user.username,
        "role": current_user.role.value,
        "account_status": current_user.account_status.value
    }

# Super admin only routes
@router.post("/users/create-admin", response_model=AdminUserResponse)
def create_admin_user(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin_role)
):
    """Create new admin user (super admin only)"""
    logger.info(f"Super admin {current_user.username} creating new admin user")
    # This would need to be implemented in services
    raise HTTPException(status_code=501, detail="Feature not yet implemented")

@router.get("/super-admin/stats", response_model=UserStatsResponse)
def get_super_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin_role)
):
    """Get detailed statistics (super admin only)"""
    logger.info(f"Super admin {current_user.username} requesting detailed statistics")
    return get_user_statistics(db)



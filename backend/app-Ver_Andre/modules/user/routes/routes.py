from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_admin_role
from app.modules.user.schemas.schemas import UserCreate, UserResponse, UserLogin, LoginResponse
from app.modules.user.services.services import create_user, get_user, get_all_users, update_user, delete_user, authenticate_user, create_user_token
from app.modules.user.models.user import User
from app.utils.logger import get_logger

router = APIRouter(prefix="/users", tags=["users"])
logger = get_logger("users-routes.py")
@router.post("/", response_model=UserResponse)
def create_new_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info("create new user")
    return create_user(db, user)

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info("register new user")
    return create_user(db, user)

@router.post("/login", response_model=LoginResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    logger.info("login user")
    user = authenticate_user(db, login_data)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_user_token(user)
    return LoginResponse(
        user=user, 
        access_token=access_token, 
        token_type="bearer",
        message="Login successful"
    )

@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get specific user information (admin only or own profile)"""
    logger.info(f"User {current_user.username} requesting user {user_id}")
    
    # Users can only view their own profile, admins can view any profile
    if user_id != current_user.userid and current_user.role.value not in ["admin", "super-admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You can only view your own profile"
        )
    
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=list[UserResponse])
def read_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    logger.info(f"Admin {current_user.username} reading all users")
    return get_all_users(db)

@router.put("/{user_id}", response_model=UserResponse)
def update_existing_user(
    user_id: str, 
    update_data: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    logger.info(f"Admin {current_user.username} updating user {user_id}")
    user = update_user(db, user_id, update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}")
def delete_existing_user(
    user_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    logger.info(f"Admin {current_user.username} deleting user {user_id}")
    
    # Prevent users from deleting themselves
    if user_id == current_user.userid:
        raise HTTPException(status_code=400, detail="Users cannot delete their own account")
    
    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@router.get("/me/", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information (protected route)"""
    logger.info(f"User {current_user.username} getting their own info")
    return current_user

@router.put("/me/", response_model=UserResponse)
def update_my_profile(
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's profile (non-sensitive fields only)"""
    logger.info(f"User {current_user.username} updating their profile")
    
    # Only allow updating username and email, not role or account_status
    allowed_fields = ['username', 'email']
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not filtered_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    user = update_user(db, current_user.userid, filtered_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

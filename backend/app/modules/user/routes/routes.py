from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user, require_admin_role
from app.core.database_postgres import get_db
from app.modules.user.models.user import User
from app.modules.user.schemas.schemas import UserCreate, UserResponse, LoginResponse, UserLogin, UserStatsResponse
from app.modules.user.services.services import create_user, get_user, get_all_users, update_user, delete_user, \
    authenticate_user, create_user_token, get_user_statistics
from app.utils.logger import get_logger

router = APIRouter(prefix="/users", tags=["users"])
logger = get_logger("users-routes.py")
@router.post("/", response_model=UserResponse)
def create_new_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"GET_DB: {db}")
    logger.info("create new user")
    return create_user(db, user)

@router.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db)):
    logger.info("read user")
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/", response_model=list[UserResponse])
def read_all_users(db: Session = Depends(get_db)):
    logger.info("read all users")
    return get_all_users(db)

@router.put("/{user_id}", response_model=UserResponse)
def update_existing_user(user_id: str, update_data: dict, db: Session = Depends(get_db)):
    logger.info("update existing user")
    user = update_user(db, user_id, update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}")
def delete_existing_user(user_id: str, db: Session = Depends(get_db)):
    logger.info("delete existing user")
    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

#added

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

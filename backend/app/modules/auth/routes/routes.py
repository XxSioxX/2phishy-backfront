

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException


from sqlalchemy.orm import Session
from app.core.database_postgres import get_db
from app.modules.user.services.services import get_user_by_email
from app.modules.auth.services.auth_service import forgot_password
from app.modules.auth.schemas.schemas import ForgotPasswordRequest, ResetPasswordRequest
from app.modules.auth.services.auth_service import reset_password

from app.utils.logger import get_logger

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

@router.post("/forgot-password")
async def forgot_password_route(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user = get_user_by_email(db, data.email)

    if user:
        background_tasks.add_task(
            forgot_password,
            db,
            user
        )

    return {"message": "If the email exists, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password_route(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    success = reset_password(db, data.token, data.new_password)

    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    return {"message": "Password reset successful"}
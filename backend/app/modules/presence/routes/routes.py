from fastapi import APIRouter, Depends

from app.modules.presence.services.service import get_online_users, mark_user_online
from app.modules.auth.services.auth_service import get_current_user,require_admin_role
from app.modules.user.models.user import User
from app.core.database_postgres import get_db
from sqlalchemy.orm import Session
from fastapi import Depends



router = APIRouter(prefix="/presence", tags=["Presence"])


@router.post("/heartbeat")
async def heartbeat(current_user=Depends(get_current_user)):
    await mark_user_online(str(current_user.userid))
    return {"status": "alive"}

@router.get("/online-status")
async def online_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    users = db.query(User).all()

    user_ids = [str(user.userid) for user in users]

    statuses = await get_online_users(user_ids)

    return statuses
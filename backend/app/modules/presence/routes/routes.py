from fastapi import APIRouter, Depends

from app.modules.presence.services.service import get_online_users, mark_user_online
from app.modules.auth.services.auth_service import get_current_user, require_admin_role
from app.modules.user.services.services import update_last_seen
from app.modules.user.models.user import User
from app.core.database_postgres import get_db
from sqlalchemy.orm import Session



router = APIRouter(prefix="/presence", tags=["Presence"])


@router.post(
    "/heartbeat",
    summary="Mark the current user online",
    description=(
        "Refreshes Redis presence and the user's `last_seen` timestamp. The "
        "frontend calls this periodically while a user is logged in."
    ),
)
async def heartbeat(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    await mark_user_online(str(current_user.userid))
    update_last_seen(db, current_user)
    return {"status": "alive"}

@router.get(
    "/online-status",
    summary="Get online status for all users",
    description=(
        "Admin-only endpoint returning a user id to online boolean map. The "
        "dashboard and user management pages use it for real-time status dots."
    ),
)
async def online_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    users = db.query(User).all()

    user_ids = [str(user.userid) for user in users]

    statuses = await get_online_users(user_ids)

    return statuses

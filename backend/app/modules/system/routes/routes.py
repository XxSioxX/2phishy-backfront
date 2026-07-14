from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database_mongo import get_mongo_db
from app.modules.auth.services.auth_service import require_admin_role, require_super_admin_role
from app.modules.system.schemas.schemas import (
    ContentDraftUpdate,
    ContentPublishRequest,
    ContentResponse,
    ContentType,
    SystemSettingsResponse,
    SystemSettingsUpdate,
)
from app.modules.system.services.services import (
    get_content_record,
    get_system_settings,
    publish_content,
    save_content_draft,
    update_system_settings,
)
from app.modules.user.models.user import User
from app.utils.logger import get_logger

router = APIRouter(prefix="/system", tags=["system"])
logger = get_logger("system-routes.py")


@router.get("/settings", response_model=SystemSettingsResponse)
async def read_system_settings(_mongo_db=Depends(get_mongo_db)):
    return await get_system_settings()


@router.put("/settings", response_model=SystemSettingsResponse)
async def write_system_settings(
    payload: SystemSettingsUpdate,
    current_user: User = Depends(require_super_admin_role),
    _mongo_db=Depends(get_mongo_db),
):
    logger.info(f"Super admin {current_user.username} updating system settings")
    dump_payload = getattr(payload, "model_dump", payload.dict)
    return await update_system_settings(
        dump_payload(exclude_unset=True),
        str(current_user.userid),
    )


@router.get("/content/{content_type}", response_model=ContentResponse)
async def read_content(
    content_type: ContentType,
    current_user: User = Depends(require_admin_role),
    _mongo_db=Depends(get_mongo_db),
):
    logger.info(f"Admin {current_user.username} reading {content_type}")
    try:
        return await get_content_record(content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/content/{content_type}/draft", response_model=ContentResponse)
async def write_content_draft(
    content_type: ContentType,
    payload: ContentDraftUpdate,
    current_user: User = Depends(require_admin_role),
    _mongo_db=Depends(get_mongo_db),
):
    logger.info(f"Admin {current_user.username} saving {content_type} draft")
    try:
        return await save_content_draft(content_type, payload.data, str(current_user.userid))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/content/{content_type}/publish", response_model=ContentResponse)
async def publish_content_record(
    content_type: ContentType,
    payload: ContentPublishRequest | None = None,
    current_user: User = Depends(require_admin_role),
    _mongo_db=Depends(get_mongo_db),
):
    logger.info(f"Admin {current_user.username} publishing {content_type}")
    try:
        data = payload.data if payload else None
        return await publish_content(content_type, str(current_user.userid), data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

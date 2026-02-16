from fastapi import APIRouter, Depends, HTTPException, status
from ..models.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse
from ..services import AnnouncementService
from app.modules.auth.services.auth_service import get_current_active_user
from app.modules.user.models.user import User, UserRole
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()
service = AnnouncementService()


def check_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Check if user is admin"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage announcements"
        )
    return current_user


@router.get("/announcements")
async def get_announcements(current_user: User = Depends(get_current_active_user)):
    """Get all announcements (students see only published)"""
    try:
        if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            # Admins see all announcements
            announcements = await service.get_all_announcements()
        else:
            # Students see only published announcements
            announcements = await service.get_published_announcements()
        return {"announcements": announcements, "status": "success"}
    except Exception as e:
        logger.error(f"Error fetching announcements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch announcements"
        )


@router.post("/announcements")
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: User = Depends(check_admin)
):
    """Create a new announcement (admin only)"""
    try:
        announcement_dict = announcement.dict()
        created = await service.create_announcement(announcement_dict)
        return {"announcement": created, "status": "success"}
    except Exception as e:
        logger.error(f"Error creating announcement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create announcement"
        )


@router.put("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: str,
    announcement: AnnouncementUpdate,
    current_user: User = Depends(check_admin)
):
    """Update an announcement (admin only)"""
    try:
        announcement_dict = announcement.dict(exclude_unset=True)
        updated = await service.update_announcement(announcement_id, announcement_dict)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        return {"announcement": updated, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating announcement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update announcement"
        )


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: User = Depends(check_admin)
):
    """Delete an announcement (admin only)"""
    try:
        deleted = await service.delete_announcement(announcement_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        return {"status": "success", "message": "Announcement deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting announcement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete announcement"
        )

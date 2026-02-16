from fastapi import APIRouter, Depends, HTTPException, status
from ..models.report import ReportCreate, ReportUpdate, ReportResponse
from ..services import ReportService
from app.modules.auth.services.auth_service import get_current_active_user
from app.modules.user.models.user import User, UserRole
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()
service = ReportService()


def check_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Check if user is admin"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all reports"
        )
    return current_user


@router.get("/reports")
async def get_reports(current_user: User = Depends(get_current_active_user)):
    """Get reports - admins see all, students see their own"""
    try:
        if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            # Admins see all reports
            reports = await service.get_all_reports()
        else:
            # Students see only their own reports
            reports = await service.get_student_reports(str(current_user.userid))
        return {"reports": reports, "status": "success"}
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch reports"
        )


@router.post("/reports")
async def create_report(
    report: ReportCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new report (students can create their own, admins can create for any student)"""
    try:
        # Students can only create reports for themselves
        if current_user.role == UserRole.STUDENT and report.studentId != str(current_user.userid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only create reports for themselves"
            )
        
        report_dict = report.dict()
        created = await service.create_report(report_dict)
        return {"report": created, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create report"
        )


@router.put("/reports/{report_id}")
async def update_report(
    report_id: str,
    report: ReportUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update a report (admins can update any, students can update unresolved own reports)"""
    try:
        existing_report = await service.get_report_by_id(report_id)
        if not existing_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        # Students can only update their own unresolved reports
        if current_user.role == UserRole.STUDENT:
            if existing_report['studentId'] != str(current_user.userid):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Students can only update their own reports"
                )
            if existing_report.get('resolved'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot update resolved reports"
                )
        
        report_dict = report.dict(exclude_unset=True)
        updated = await service.update_report(report_id, report_dict)
        return {"report": updated, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update report"
        )


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a report (admins can delete any, students can delete unresolved own reports)"""
    try:
        existing_report = await service.get_report_by_id(report_id)
        if not existing_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        # Students can only delete their own unresolved reports
        if current_user.role == UserRole.STUDENT:
            if existing_report['studentId'] != str(current_user.userid):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Students can only delete their own reports"
                )
            if existing_report.get('resolved'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot delete resolved reports"
                )
        
        deleted = await service.delete_report(report_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        return {"status": "success", "message": "Report deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete report"
        )

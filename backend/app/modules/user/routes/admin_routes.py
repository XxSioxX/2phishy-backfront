from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List
from uuid import UUID

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database_postgres import get_db
from app.core.database_mongo import get_mongo_db
from app.modules.auth.services.auth_service import require_admin_role, require_super_admin_role, get_current_user_role
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


def _serialize_export_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize_export_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_export_value(item) for item in value]
    return value


def _user_export_row(user: User) -> Dict[str, Any]:
    return {
        "userid": str(user.userid),
        "username": user.username,
        "email": user.email,
        "role": user.role.value,
        "account_status": user.account_status.value,
        "created_at": _serialize_export_value(user.created_at),
        "last_login": _serialize_export_value(user.last_login),
        "last_seen": _serialize_export_value(user.last_seen),
        "privacy_policy_accepted": bool(getattr(user, "privacy_policy_accepted", False)),
        "privacy_policy_accepted_at": _serialize_export_value(getattr(user, "privacy_policy_accepted_at", None)),
        "thesis_consent_accepted": bool(getattr(user, "thesis_consent_accepted", False)),
        "thesis_consent_accepted_at": _serialize_export_value(getattr(user, "thesis_consent_accepted_at", None)),
        "consent_version": getattr(user, "consent_version", None),
    }


def _latest_answer_timestamp(answers: List[Dict[str, Any]]) -> Any:
    latest = None
    for answer in answers:
        timestamp = answer.get("timestamp")
        if timestamp is None:
            continue
        if latest is None or str(timestamp) > str(latest):
            latest = timestamp
    return _serialize_export_value(latest)


def _iter_topic_answers(progress_data: Dict[str, Any]):
    for topic_name, topic_data in progress_data.items():
        if not isinstance(topic_data, dict):
            continue
        answers = topic_data.get("answers", [])
        if not isinstance(answers, list):
            continue
        yield topic_name, [answer for answer in answers if isinstance(answer, dict)]


def _build_quiz_and_progress_rows(
    progress_docs: List[Dict[str, Any]],
    username_by_id: Dict[str, str],
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    quiz_rows = []
    progress_rows = []

    for doc in progress_docs:
        user_id = str(doc.get("user_id", ""))
        username = username_by_id.get(user_id, "Unknown User")
        progress_data = doc.get("progress", {})
        if not isinstance(progress_data, dict):
            continue

        for topic_name, answers in _iter_topic_answers(progress_data):
            total_questions = len(answers)
            correct_answers = sum(1 for answer in answers if answer.get("is_correct") is True)
            score = round((correct_answers / total_questions) * 100) if total_questions else 0
            topic_progress = progress_data.get(topic_name, {})

            row = {
                "user_id": user_id,
                "username": username,
                "topic": topic_name,
                "correct_answers": correct_answers,
                "total_questions": total_questions,
                "score": score,
                "latest_answer_at": _latest_answer_timestamp(answers),
            }
            quiz_rows.append(row)
            progress_rows.append({
                **row,
                "level_completed": topic_progress.get("level_completed", False),
                "current_zone": topic_progress.get("current_zone"),
                "answers_json": _serialize_export_value(answers),
                "gameplay_json": _serialize_export_value(topic_progress.get("gameplay", {})),
            })

    quiz_rows.sort(key=lambda row: str(row.get("latest_answer_at") or ""), reverse=True)
    progress_rows.sort(key=lambda row: (row.get("username") or "", row.get("topic") or ""))
    return quiz_rows, progress_rows


def _build_initial_assessment_rows(
    assessment_docs: List[Dict[str, Any]],
    username_by_id: Dict[str, str],
) -> List[Dict[str, Any]]:
    rows = []
    for doc in assessment_docs:
        user_id = str(doc.get("user_id", ""))
        username = username_by_id.get(user_id, "Unknown User")
        assessments = doc.get("assessments", {})
        if not isinstance(assessments, dict):
            continue

        for topic, assessment in assessments.items():
            if not isinstance(assessment, dict):
                continue
            question_map = assessment.get("question_map", [])
            rows.append({
                "user_id": user_id,
                "username": username,
                "topic": topic,
                "assessment_completed": assessment.get("assessment_completed", False),
                "assessment_completed_at": _serialize_export_value(assessment.get("assessment_completed_at")),
                "question_map_count": len(question_map) if isinstance(question_map, list) else 0,
                "subcat_scores_json": _serialize_export_value(assessment.get("subcat_scores", {})),
                "subcat_priority_json": _serialize_export_value(assessment.get("subcat_priority", [])),
                "question_map_json": _serialize_export_value(question_map),
            })

    rows.sort(key=lambda row: (row.get("username") or "", row.get("topic") or ""))
    return rows


def _build_score_profile_rows(progress_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in progress_rows:
        user_id = row["user_id"]
        current = grouped.setdefault(user_id, {
            "user_id": user_id,
            "username": row["username"],
            "correct_answers": 0,
            "total_questions": 0,
            "topics_started": 0,
        })
        current["correct_answers"] += row.get("correct_answers", 0)
        current["total_questions"] += row.get("total_questions", 0)
        current["topics_started"] += 1

    profiles = []
    for profile in grouped.values():
        total = profile["total_questions"]
        profiles.append({
            **profile,
            "overall_score": round((profile["correct_answers"] / total) * 100) if total else 0,
        })

    profiles.sort(key=lambda row: row["overall_score"], reverse=True)
    return profiles

@router.get("/stats", response_model=UserStatsResponse)
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    """Get user statistics for admin dashboard"""
    logger.info(f"Admin {current_user.username} requesting user statistics")
    return get_user_statistics(db)


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
async def delete_user_admin(
    user_id: str,
    db: Session = Depends(get_db),
    mongo_db = Depends(get_mongo_db),
    current_user: User = Depends(require_admin_role)
):
    """Delete user (admin only)"""
    logger.info(f"Admin {current_user.username} deleting user: {user_id}")
    
    # Prevent users from deleting themselves
    if str(user_id) == str(current_user.userid):
        raise HTTPException(status_code=400, detail="Users cannot delete their own account")

    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    mongo_user_id = str(user.userid)
    mongo_cleanup = {
        "progress": await mongo_db["progress"].delete_many({"user_id": mongo_user_id}),
        "initial_assessments": await mongo_db["initial_assessments"].delete_many({"user_id": mongo_user_id}),
        "reports": await mongo_db["reports"].delete_many({"studentId": mongo_user_id}),
    }

    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(
        "Deleted user %s with Mongo cleanup counts: %s",
        mongo_user_id,
        {name: result.deleted_count for name, result in mongo_cleanup.items()}
    )
    return {
        "message": "User deleted successfully",
        "deleted": {
            "user": True,
            "progress": mongo_cleanup["progress"].deleted_count,
            "initial_assessments": mongo_cleanup["initial_assessments"].deleted_count,
            "reports": mongo_cleanup["reports"].deleted_count,
        }
    }

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


@router.get("/data-export")
async def get_admin_data_export(
    db: Session = Depends(get_db),
    mongo_db = Depends(get_mongo_db),
    current_user: User = Depends(require_admin_role),
):
    """Return admin-only export data for settings data management."""
    logger.info(f"Admin {current_user.username} exporting collected data")

    users = db.query(User).all()
    username_by_id = {str(user.userid): user.username for user in users}
    user_rows = [_user_export_row(user) for user in users]

    assessment_docs = await mongo_db["initial_assessments"].find({}).to_list(None)
    progress_docs = await mongo_db["progress"].find({}).to_list(None)
    report_docs = await mongo_db["reports"].find({}).to_list(None)

    quiz_rows, progress_rows = _build_quiz_and_progress_rows(progress_docs, username_by_id)
    initial_assessment_rows = _build_initial_assessment_rows(assessment_docs, username_by_id)
    score_profile_rows = _build_score_profile_rows(progress_rows)

    return {
        "metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "exported_by": str(current_user.userid),
            "exported_by_username": current_user.username,
            "users_count": len(user_rows),
            "initial_assessment_rows_count": len(initial_assessment_rows),
            "progress_rows_count": len(progress_rows),
            "quiz_insights_rows_count": len(quiz_rows),
            "reports_count": len(report_docs),
            "score_profiles_count": len(score_profile_rows),
        },
        "users": user_rows,
        "initial_assessments": {
            "summary": initial_assessment_rows,
            "raw": _serialize_export_value(assessment_docs),
        },
        "progress": {
            "summary": progress_rows,
            "raw": _serialize_export_value(progress_docs),
        },
        "quiz_insights": quiz_rows,
        "reports": _serialize_export_value(report_docs),
        "score_profiles": score_profile_rows,
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




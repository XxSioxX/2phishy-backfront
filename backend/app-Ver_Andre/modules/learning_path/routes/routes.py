from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.modules.user.models.user import User
from app.modules.learning_path.models.learn_path import Topics, UserLearnPath
from app.modules.learning_path.services.learn_path_service import (
    create_learning_path, 
    get_user_learning_paths, 
    update_learning_path_score, 
    mark_learning_path_completed
)
from app.utils.logger import get_logger
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/learning-path", tags=["learning-path"])
logger = get_logger("learning-path-routes.py")

class LearningPathCreate(BaseModel):
    topic: Topics
    subtopic: str
    score: float = 0.0

class LearningPathUpdate(BaseModel):
    score: float

class LearningPathResponse(BaseModel):
    id: str
    user_id: str
    topic: str
    subtopic: str
    priority: str
    score: float
    completed: int
    created_at: str
    updated_at: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=LearningPathResponse)
def create_new_learning_path(
    learning_path: LearningPathCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new learning path entry for the current user"""
    logger.info(f"Creating learning path for user {current_user.userid}")
    return create_learning_path(db, current_user.userid, learning_path.topic, learning_path.subtopic, learning_path.score)

@router.get("/", response_model=List[LearningPathResponse])
def get_my_learning_paths(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all learning paths for the current user"""
    logger.info(f"Getting learning paths for user {current_user.userid}")
    return get_user_learning_paths(db, current_user.userid)

@router.get("/{user_id}", response_model=List[LearningPathResponse])
def get_user_learning_paths_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all learning paths for a specific user (admin only or own data)"""
    logger.info(f"User {current_user.username} getting learning paths for user {user_id}")
    
    # Users can only view their own learning paths, admins can view any user's paths
    if user_id != current_user.userid and current_user.role.value not in ["admin", "super-admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You can only view your own learning paths"
        )
    
    return get_user_learning_paths(db, user_id)

@router.put("/{path_id}/score", response_model=LearningPathResponse)
def update_learning_path_score_endpoint(
    path_id: str,
    update_data: LearningPathUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update the score of a learning path"""
    logger.info(f"Updating learning path {path_id} score to {update_data.score}")
    result = update_learning_path_score(db, path_id, update_data.score)
    if not result:
        raise HTTPException(status_code=404, detail="Learning path not found")
    return result

@router.put("/{path_id}/complete", response_model=LearningPathResponse)
def mark_learning_path_completed_endpoint(
    path_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a learning path as completed"""
    logger.info(f"Marking learning path {path_id} as completed")
    result = mark_learning_path_completed(db, path_id)
    if not result:
        raise HTTPException(status_code=404, detail="Learning path not found")
    return result

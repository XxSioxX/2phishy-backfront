from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.modules.user.models.user import User
from app.modules.game.models.game import GameProgress, GameScore
from app.utils.logger import get_logger
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/game", tags=["game"])
logger = get_logger("game-routes.py")

class GameProgressCreate(BaseModel):
    level: int = 1
    current_score: int = 0
    highest_score: int = 0
    enemies_defeated: int = 0
    chests_collected: int = 0
    time_played: float = 0.0
    completed: bool = False
    save_data: Optional[str] = None

class GameProgressUpdate(BaseModel):
    level: Optional[int] = None
    current_score: Optional[int] = None
    highest_score: Optional[int] = None
    enemies_defeated: Optional[int] = None
    chests_collected: Optional[int] = None
    time_played: Optional[float] = None
    completed: Optional[bool] = None
    save_data: Optional[str] = None

class GameScoreCreate(BaseModel):
    score: int
    level: int
    enemies_defeated: int = 0
    chests_collected: int = 0
    time_taken: float

class GameProgressResponse(BaseModel):
    id: str
    user_id: str
    level: int
    current_score: int
    highest_score: int
    enemies_defeated: int
    chests_collected: int
    time_played: float
    completed: bool
    created_at: str
    updated_at: str
    save_data: Optional[str] = None

    class Config:
        from_attributes = True

class GameScoreResponse(BaseModel):
    id: str
    user_id: str
    score: int
    level: int
    enemies_defeated: int
    chests_collected: int
    time_taken: float
    created_at: str

    class Config:
        from_attributes = True

@router.post("/progress/", response_model=GameProgressResponse)
def create_game_progress(
    progress: GameProgressCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create or update game progress for the current user"""
    logger.info(f"Creating/updating game progress for user {current_user.userid}")
    
    # Check if user already has progress
    existing_progress = db.query(GameProgress).filter(GameProgress.user_id == current_user.userid).first()
    
    if existing_progress:
        # Update existing progress
        for field, value in progress.dict(exclude_unset=True).items():
            setattr(existing_progress, field, value)
        existing_progress.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_progress)
        return existing_progress
    else:
        # Create new progress
        new_progress = GameProgress(
            user_id=current_user.userid,
            **progress.dict()
        )
        db.add(new_progress)
        db.commit()
        db.refresh(new_progress)
        return new_progress

@router.get("/progress/", response_model=GameProgressResponse)
def get_my_game_progress(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get game progress for the current user"""
    logger.info(f"Getting game progress for user {current_user.userid}")
    
    progress = db.query(GameProgress).filter(GameProgress.user_id == current_user.userid).first()
    if not progress:
        raise HTTPException(status_code=404, detail="No game progress found")
    return progress

@router.put("/progress/", response_model=GameProgressResponse)
def update_game_progress(
    progress_update: GameProgressUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update game progress for the current user"""
    logger.info(f"Updating game progress for user {current_user.userid}")
    
    progress = db.query(GameProgress).filter(GameProgress.user_id == current_user.userid).first()
    if not progress:
        raise HTTPException(status_code=404, detail="No game progress found")
    
    for field, value in progress_update.dict(exclude_unset=True).items():
        setattr(progress, field, value)
    
    progress.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(progress)
    return progress

@router.post("/scores/", response_model=GameScoreResponse)
def create_game_score(
    score: GameScoreCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Save a new game score"""
    logger.info(f"Saving game score for user {current_user.userid}")
    
    new_score = GameScore(
        user_id=current_user.userid,
        **score.dict()
    )
    db.add(new_score)
    db.commit()
    db.refresh(new_score)
    return new_score

@router.get("/scores/", response_model=List[GameScoreResponse])
def get_my_game_scores(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all game scores for the current user"""
    logger.info(f"Getting game scores for user {current_user.userid}")
    
    scores = db.query(GameScore).filter(GameScore.user_id == current_user.userid).order_by(GameScore.score.desc()).all()
    return scores

@router.get("/scores/top", response_model=List[GameScoreResponse])
def get_top_scores(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get top game scores across all users"""
    logger.info(f"Getting top {limit} game scores")
    
    scores = db.query(GameScore).order_by(GameScore.score.desc()).limit(limit).all()
    return scores

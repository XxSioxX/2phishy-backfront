from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.modules.user.models.user import User
from app.modules.game.models.game import GameProgress, GameScore
from app.modules.game.models.assessment import AssessmentSession, AssessmentResult
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

# Assessment schemas
class AssessmentSessionCreate(BaseModel):
    topic: str
    start_time: str

class AssessmentResultCreate(BaseModel):
    question_id: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    topic: str
    subcategory: str
    timestamp: str

class AssessmentSessionEnd(BaseModel):
    end_time: str
    total_score: int
    total_questions: int

class AssessmentSessionResponse(BaseModel):
    id: str
    session_id: str
    user_id: str
    topic: str
    start_time: str
    end_time: Optional[str] = None
    total_score: int
    total_questions: int
    completed: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class AssessmentResultResponse(BaseModel):
    id: str
    session_id: str
    question_id: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    topic: str
    subcategory: str
    timestamp: str
    created_at: str

    class Config:
        from_attributes = True

# Assessment endpoints
@router.post("/assessment/start", response_model=AssessmentSessionResponse)
def start_assessment_session(
    session_data: AssessmentSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a new assessment session"""
    logger.info(f"Starting assessment session for user {current_user.userid}")
    
    new_session = AssessmentSession(
        user_id=current_user.userid,
        topic=session_data.topic,
        start_time=datetime.fromisoformat(session_data.start_time.replace('Z', '+00:00'))
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    # Convert datetime fields to strings for JSON serialization
    return {
        "id": new_session.id,
        "session_id": new_session.session_id,
        "user_id": new_session.user_id,
        "topic": new_session.topic,
        "start_time": new_session.start_time.isoformat() if new_session.start_time else None,
        "end_time": new_session.end_time.isoformat() if new_session.end_time else None,
        "total_score": new_session.total_score,
        "total_questions": new_session.total_questions,
        "completed": new_session.completed,
        "created_at": new_session.created_at.isoformat() if new_session.created_at else None,
        "updated_at": new_session.updated_at.isoformat() if new_session.updated_at else None,
    }

@router.post("/assessment/result")
def submit_assessment_result(
    result_data: AssessmentResultCreate,
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Submit an assessment result"""
    logger.info(f"Submitting assessment result for user {current_user.userid}")
    
    # Verify session belongs to user
    session = db.query(AssessmentSession).filter(
        AssessmentSession.session_id == session_id,
        AssessmentSession.user_id == current_user.userid
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    
    new_result = AssessmentResult(
        session_id=session_id,
        question_id=result_data.question_id,
        user_answer=result_data.user_answer,
        correct_answer=result_data.correct_answer,
        is_correct=result_data.is_correct,
        topic=result_data.topic,
        subcategory=result_data.subcategory,
        timestamp=datetime.fromisoformat(result_data.timestamp.replace('Z', '+00:00'))
    )
    db.add(new_result)
    db.commit()
    return {"message": "Assessment result submitted successfully"}

@router.post("/assessment/end", response_model=AssessmentSessionResponse)
def end_assessment_session(
    session_id: str,
    end_data: AssessmentSessionEnd,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """End an assessment session"""
    logger.info(f"Ending assessment session for user {current_user.userid}")
    
    session = db.query(AssessmentSession).filter(
        AssessmentSession.session_id == session_id,
        AssessmentSession.user_id == current_user.userid
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    
    session.end_time = datetime.fromisoformat(end_data.end_time.replace('Z', '+00:00'))
    session.total_score = end_data.total_score
    session.total_questions = end_data.total_questions
    session.completed = True
    session.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(session)
    
    # Convert datetime fields to strings for JSON serialization
    return {
        "id": session.id,
        "session_id": session.session_id,
        "user_id": session.user_id,
        "topic": session.topic,
        "start_time": session.start_time.isoformat() if session.start_time else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "total_score": session.total_score,
        "total_questions": session.total_questions,
        "completed": session.completed,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }

@router.get("/assessment/history/{user_id}", response_model=List[AssessmentSessionResponse])
def get_user_assessment_history(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get assessment history for a user"""
    logger.info(f"Getting assessment history for user {user_id}")
    
    # Only allow users to see their own history or admins to see any history
    if current_user.userid != user_id and current_user.role not in ['admin', 'super-admin']:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's history")
    
    sessions = db.query(AssessmentSession).filter(
        AssessmentSession.user_id == user_id
    ).order_by(AssessmentSession.created_at.desc()).all()
    
    # Convert datetime fields to strings for JSON serialization
    return [
        {
            "id": session.id,
            "session_id": session.session_id,
            "user_id": session.user_id,
            "topic": session.topic,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "total_score": session.total_score,
            "total_questions": session.total_questions,
            "completed": session.completed,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        }
        for session in sessions
    ]

@router.get("/assessment/stats/{user_id}")
def get_assessment_stats(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get assessment statistics for a user"""
    logger.info(f"Getting assessment stats for user {user_id}")
    
    # Only allow users to see their own stats or admins to see any stats
    if current_user.userid != user_id and current_user.role not in ['admin', 'super-admin']:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's stats")
    
    # Get completed sessions
    completed_sessions = db.query(AssessmentSession).filter(
        AssessmentSession.user_id == user_id,
        AssessmentSession.completed == True
    ).all()
    
    if not completed_sessions:
        return {
            "total_sessions": 0,
            "average_score": 0,
            "total_questions": 0,
            "correct_answers": 0,
            "topics_completed": []
        }
    
    total_sessions = len(completed_sessions)
    total_score = sum(session.total_score for session in completed_sessions)
    total_questions = sum(session.total_questions for session in completed_sessions)
    average_score = total_score / total_sessions if total_sessions > 0 else 0
    
    # Get all results for this user
    all_results = db.query(AssessmentResult).join(AssessmentSession).filter(
        AssessmentSession.user_id == user_id
    ).all()
    
    correct_answers = sum(1 for result in all_results if result.is_correct)
    topics_completed = list(set(session.topic for session in completed_sessions))
    
    return {
        "total_sessions": total_sessions,
        "average_score": round(average_score, 2),
        "total_questions": total_questions,
        "correct_answers": correct_answers,
        "topics_completed": topics_completed
    }

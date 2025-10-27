# takes in the topic value, the grades in a list format
from ..models.learn_path import Topics, SubtopicPriority, UserLearnPath
from sqlalchemy.orm import Session
from app.utils.logger import get_logger
from datetime import datetime

logger = get_logger("learn_path_service.py")

def score_to_priority(score: float) -> SubtopicPriority:
    if 0 <= score <= 0.45:
        return SubtopicPriority.HIGH
    elif 0.46 <= score <= 0.85:
        return SubtopicPriority.MODERATE
    else:
        return SubtopicPriority.LOW

def evaluate_subcategory(topic: Topics, subcat_results: dict):
    subcat_priorities = {}
    for subcat, score in subcat_results.items():
        subcat_priorities[subcat] = score_to_priority(score)
    return topic, subcat_priorities

def create_learning_path(db: Session, user_id: str, topic: Topics, subtopic: str, score: float = 0.0):
    """Create a new learning path entry for a user"""
    logger.info(f"Creating learning path for user {user_id}, topic: {topic.value}, subtopic: {subtopic}")
    
    priority = score_to_priority(score)
    new_path = UserLearnPath(
        user_id=user_id,
        topic=topic,
        subtopic=subtopic,
        priority=priority,
        score=score
    )
    
    db.add(new_path)
    db.commit()
    db.refresh(new_path)
    logger.info(f"Learning path created: {new_path.id}")
    return new_path

def get_user_learning_paths(db: Session, user_id: str):
    """Get all learning paths for a user"""
    logger.info(f"Retrieving learning paths for user {user_id}")
    return db.query(UserLearnPath).filter(UserLearnPath.user_id == user_id).all()

def update_learning_path_score(db: Session, path_id: str, new_score: float):
    """Update the score and priority of a learning path"""
    logger.info(f"Updating learning path {path_id} with score {new_score}")
    
    path = db.query(UserLearnPath).filter(UserLearnPath.id == path_id).first()
    if not path:
        return None
    
    path.score = new_score
    path.priority = score_to_priority(new_score)
    path.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(path)
    logger.info(f"Learning path updated: {path_id}")
    return path

def mark_learning_path_completed(db: Session, path_id: str):
    """Mark a learning path as completed"""
    logger.info(f"Marking learning path {path_id} as completed")
    
    path = db.query(UserLearnPath).filter(UserLearnPath.id == path_id).first()
    if not path:
        return None
    
    path.completed = 2  # 2 = completed
    path.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(path)
    logger.info(f"Learning path marked as completed: {path_id}")
    return path

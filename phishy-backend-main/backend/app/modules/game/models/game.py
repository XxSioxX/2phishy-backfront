from sqlalchemy import Column, String, DateTime, Integer, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base

class GameProgress(Base):
    __tablename__ = 'game_progress'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.userid'), nullable=False)
    level = Column(Integer, default=1)
    current_score = Column(Integer, default=0)
    highest_score = Column(Integer, default=0)
    enemies_defeated = Column(Integer, default=0)
    chests_collected = Column(Integer, default=0)
    time_played = Column(Float, default=0.0)  # in seconds
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    save_data = Column(Text, nullable=True)  # JSON string for game state

    # Relationship (will be added later)
    # user = relationship("User", back_populates="game_progress")

class GameScore(Base):
    __tablename__ = 'game_scores'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.userid'), nullable=False)
    score = Column(Integer, nullable=False)
    level = Column(Integer, nullable=False)
    enemies_defeated = Column(Integer, default=0)
    chests_collected = Column(Integer, default=0)
    time_taken = Column(Float, nullable=False)  # in seconds
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship (will be added later)
    # user = relationship("User", back_populates="game_scores")

# Relationships will be added later to avoid circular imports

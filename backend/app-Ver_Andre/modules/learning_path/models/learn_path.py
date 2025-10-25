from sqlalchemy import Column, String, DateTime, Enum, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base
from enum import Enum as PyEnum

class Topics(PyEnum):
    SFB_T = "Safe Browsing Practices"
    PS_T = "Password Security"
    M_T = "Malware"
    SE_T = "Social Engineering"
    IR_T = "Incident Response"

class SubtopicPriority(PyEnum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"

class UserLearnPath(Base):
    __tablename__ = 'user_learn_path'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.userid'), nullable=False)
    topic = Column(Enum(Topics), nullable=False)
    subtopic = Column(String, nullable=False)
    priority = Column(Enum(SubtopicPriority), nullable=False)
    score = Column(Float, default=0.0)
    completed = Column(Integer, default=0)  # 0 = not started, 1 = in progress, 2 = completed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)

    # Relationship (will be added later)
    # user = relationship("User", back_populates="learning_paths")

# Relationship will be added later to avoid circular imports

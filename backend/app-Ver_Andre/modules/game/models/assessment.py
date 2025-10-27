from sqlalchemy import Column, String, DateTime, Integer, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.core.database import Base

class AssessmentSession(Base):
    __tablename__ = 'assessment_sessions'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.userid'), nullable=False)
    topic = Column(String, nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    total_score = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to assessment results
    results = relationship("AssessmentResult", back_populates="session", cascade="all, delete-orphan")

class AssessmentResult(Base):
    __tablename__ = 'assessment_results'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey('assessment_sessions.session_id'), nullable=False)
    question_id = Column(String, nullable=False)
    user_answer = Column(String, nullable=False)
    correct_answer = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    topic = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to assessment session
    session = relationship("AssessmentSession", back_populates="results")

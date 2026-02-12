from io import StringIO

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.modules.game.models.game import AssessmentSubmission
from app.modules.learning_path.models.learn_path import Topics


class InitialAssessmentRequest(BaseModel):
    userid: UUID
    topic: Topics
    assessment_response: AssessmentSubmission
    
class SingleResponseItem(BaseModel):
    userid: UUID
    question_id: str
    question_subtopic: str
    answer: str
    topic: str
    is_correct: bool
    timestamp: datetime

class InitialAssessmentResponseItems(BaseModel):
    inserted_id: str
    timestamp: datetime
    userid: UUID

class GetUser(BaseModel):
    userid: str
    collectionName: Optional[str] = None

class TopicCompletionRequest(BaseModel):
    userid: str
    topic: str

class GetUserTopic(GetUser):
    topic: Topics

class TopicRequest(BaseModel):
    topic: Topics


# Assessment session schemas
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

class SocEngineeringSubmit(BaseModel):
    user_id: str
    topic: str
    is_success: bool
    updated_at: str

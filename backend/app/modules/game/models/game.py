from datetime import datetime

from pydantic import BaseModel
from typing import List
from app.modules.learning_path.models.learn_path import Topics, Subtopic
from uuid import UUID

class AssessmentRequest(BaseModel):
    assessment_id: str
    question_id: str
    question_subtopic: Subtopic

class QuestionResponse(BaseModel):
    assessment_request: AssessmentRequest
    answer: str
    is_correct: bool
    timestamp: datetime


class QuestionRequest(BaseModel):
    assessment_request: str
    question_id: str
    question_subtopic: Subtopic
    answer: str

class AssessmentSubmission(BaseModel):
    responses: List[QuestionResponse]


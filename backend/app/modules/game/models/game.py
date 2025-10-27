from pydantic import BaseModel
from typing import List
from app.modules.learning_path.models.learn_path import Topics, Subtopic
from uuid import UUID


class QuestionRequest(BaseModel):
    question_id: str
    question_subtopic: Subtopic
    answer: str

class AssessmentSubmission(BaseModel):
    responses: List[QuestionRequest]

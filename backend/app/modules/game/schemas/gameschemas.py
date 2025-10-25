from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from app.modules.game.models.game import AssessmentSubmission
from app.modules.learning_path.models.learn_path import Topics


class InitialAssessmentRequest(BaseModel):
    userid: UUID
    topic: Topics
    assessment_response: AssessmentSubmission

class InitialAssessmentResponse(BaseModel):
    inserted_id: str
    timestamp: datetime
    userid: UUID

class GetUser(BaseModel):
    userid: UUID
    collectionName: str

class GetUserTopic(GetUser):
    topic: Topics
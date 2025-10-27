# interfaces/learning.py
from abc import ABC, abstractmethod
from app.modules.game.models.game import QuestionRequest

class LearningEvaluator(ABC):
    @abstractmethod
    def evaluate_answer(self, answer: QuestionRequest, question_map: dict) -> bool:
        pass

    @abstractmethod
    def build_question_map(self, *files) -> dict:
        pass

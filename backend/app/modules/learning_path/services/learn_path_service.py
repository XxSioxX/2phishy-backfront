# takes in the topic value, the grades in a list format
from app.interfaces.learning import LearningEvaluator
from app.modules.learning_path.models.learn_path import Topics, SubtopicPriority
from app.modules.game.models.game import QuestionRequest
import json
from uuid import UUID

from app.utils.logger import get_logger

logger = get_logger()

class DefaultLearningEvaluator(LearningEvaluator):
    def evaluate_answer(self, answer, question_map):
        return evaluate_answer(answer, question_map)

    def build_question_map(self, *files):
        return build_question_map(*files)

    def score_to_priority(self, score: float):
        return score_to_priority(score)

    def evaluate_subcat_priority(self, topic: Topics, subcat_results: dict):
        return evaluate_subcat_priority(topic, subcat_results)

    def load_questions(self, filepath):
        return load_questions(filepath)


def score_to_priority(score: float) -> SubtopicPriority:
    if 0 <= score <= 0.45:
        return SubtopicPriority.HIGH
    elif 0.46 <= score <= 0.85:
        return SubtopicPriority.MODERATE
    else:
        return SubtopicPriority.LOW

def evaluate_subcat_priority(topic: Topics, subcat_results: dict):
    subcat_priorities = {}
    for subcat, score in subcat_results.items():
        subcat_priorities[subcat] = score_to_priority(score)

    return topic, subcat_priorities

def load_questions(filepath):
    logger.info("loading questions from: {}".format(filepath))
    with open(filepath, "r") as f:
        return json.load(f)

def build_question_map(*files):
    question_map = {}
    for file in files:
        logger.info(f"Loading questions from {file}")
        topics = load_questions(file)  # top-level is a list of topic dicts
        logger.info(f"Loaded {len(topics)} topics")

        for topic in topics:
            for q in topic.get("initial_assessment", []):
                question_map[q["question_id"]] = q
    logger.info(f"Question map: {question_map}")
    return question_map

def evaluate_answer(answer: QuestionRequest, question_map):
    logger.info(f"Evaluating question: {answer}")
    qid = answer.question_id
    logger.info(f"Evaluating question qid: {qid}")
    user_answer = answer.answer
    logger.info(f"Evaluating question user_answer: {user_answer}")
    question = question_map[qid]
    logger.info(f"Evaluating question _question: {question}")

    if question:

        correct_answer = question["answer"]
        is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
        if is_correct:
            return True
        else:
            return False
    else:
        return "Invalid answer"



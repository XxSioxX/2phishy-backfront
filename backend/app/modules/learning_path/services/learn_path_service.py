# takes in the topic value, the grades in a list format
from app.interfaces.learning import LearningEvaluator
from app.modules.learning_path.models.learn_path import Topics, SubtopicPriority
from app.modules.game.models.game import QuestionRequest
import json
from uuid import UUID
from pathlib import Path
from app.utils.logger import get_logger
from app.core.cache_redis import redis_client as redis


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

async def build_question_map(*files):

    question_map = {}

    for file in files:

        file_path = Path(file)
        redis_key = f"static:initial_assessment:{file_path.name}"

        topics = await get_static_asset(redis_key, file_path)

        logger.info(f"Loaded {len(topics)} topics from {file_path.name}")

        for topic in topics:
            for q in topic.get("initial_assessment", []):
                question_map[q["question_id"]] = q

    logger.info(f"Built question map with {len(question_map)} questions")

    return question_map

def evaluate_answer(answer: QuestionRequest, question_map):

    qid = answer.assessment_request.question_id
    user_answer = answer.answer

    question = question_map.get(qid)

    if not question:
        return "Invalid answer"

    correct_answer = question["answer"]

    return user_answer.strip().lower() == correct_answer.strip().lower()

async def get_static_asset(key: str, file_path: Path):
    try:
        data = await redis.get(key)

        if data:
            return json.loads(data)

        logger.warning(f"Redis cache miss for {key}. Reloading from file.")

        with open(file_path, "r") as f:
            parsed = json.load(f)

        await redis.set(key, json.dumps(parsed), ex=3600)

        return parsed

    except Exception as e:
        logger.error(f"Redis failure for {key}, fallback to file: {e}")
        with open(file_path, "r") as f:
            return json.load(f)
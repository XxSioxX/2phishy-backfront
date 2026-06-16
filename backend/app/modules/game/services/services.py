from app.modules.learning_path.models.learn_path import Topics, Subtopic
from app.interfaces.learning import LearningEvaluator
from app.utils.logger import get_logger
from collections import defaultdict
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from pathlib import Path
from enum import Enum
import json
import random
import os

from app.modules.game.schemas.gameschemas import SingleResponseItem
from app.core.cache_redis import redis_client as redis


logger = get_logger()

BASE_DIR = Path(__file__).resolve().parents[3]
ASSETS_DIR = BASE_DIR / "backend-assets"


def map_subtopic_to_enum(subtopic_str: str) -> Subtopic:
    try:
        return Subtopic[subtopic_str.upper()]
    except KeyError:
        logger.error(f"Invalid subtopic: {subtopic_str}")
        raise ValueError(f"Invalid subtopic: {subtopic_str}")


async def evaluate_assessment(response, evaluator: LearningEvaluator):
    json_path = ASSETS_DIR / "initial_assessment.json"

    logger.info(f"Evaluating assessment from file path: {json_path}")

    question_map = await evaluator.build_question_map(json_path)
    logger.info(f"Loaded question map with {len(question_map)} questions")

    question_ids = [
        "safebrowsing",
        "passsec",
        "malware",
        "socialengineering",
        "incidentresponse",
    ]

    logger.info(f"Evaluating assessment with response: {response}")

    try:
        result_dict = {}

        for item in response.responses:
            assessment_id = item.assessment_request.assessment_id
            subtopic_enum = item.assessment_request.question_subtopic
            prefix = assessment_id.split("-")[0]
            logger.info(f"DEBUG PREFIX: {prefix}")
            if prefix in question_ids:
                try:
                    result = evaluator.evaluate_answer(item, question_map)
                    logger.info(f"RESULT: {result}")
                    result_dict[assessment_id] = (subtopic_enum, result)
                except ValueError:

                    result_dict[assessment_id] = "Invalid subtopic"
            else:
                result_dict[assessment_id] = "Invalid prefix"
        logger.info(f"Evaluated assessment: {result_dict}")
        return result_dict
    except Exception as e:
        logger.error(f"Assessment response evaluation error: {e}")
        return {"error": str(e)}

def evaluate_subcat_grade(assessment_result: dict) -> dict:
    subtopic_scores = defaultdict(lambda: {"correct": 0, "total": 0})
    logger.info("Evaluating subcat grade")
    logger.debug(f"Assessment result: {assessment_result}")

    for question_id, value in assessment_result.items():

        # Skip invalid entries like "Invalid prefix"
        if not isinstance(value, tuple):
            continue

        subtopic, is_correct = value

        subtopic_scores[subtopic]["total"] += 1

        if is_correct:
            subtopic_scores[subtopic]["correct"] += 1

    # Avoid division by zero
    return {
        subtopic: round(
            scores["correct"] / scores["total"], 2
        ) if scores["total"] > 0 else 0
        for subtopic, scores in subtopic_scores.items()
    }

def mongo_serialize(obj):
    if isinstance(obj, dict):
        return {mongo_serialize(k): mongo_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [mongo_serialize(v) for v in obj]
    elif isinstance(obj, Enum):
        return obj.value
    elif isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj  # already BSON-serializable
    else:
        return obj

async def assessment_check(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    subtopic_key: str
) -> bool:

    logger.info("Checking if initial assessment exists: ")
    collection = db["initial_assessments"]
    query = {
        "user_id": str(user_id),
        "topic": topic.value,
        "subcat_priority": {
            "$elemMatch": {
                subtopic_key: {"$exists": True}
            }
        }
    }
    logger.info(f"QUERY: {query}")

    return await collection.find_one(query) is not None

async def ensure_initial_assessment_done(db, user_id, topic):
    doc = await db["initial_assessments"].find_one(
        {
            "user_id": str(user_id),
            f"assessments.{topic.value}.assessment_completed": True
        }

    )
    if not doc:
        raise Exception("Initial assessment not completed")


async def save_assessment_result(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    subcat_grade: dict,
    subcat_priority: list
):
    logger.info("Saving assessment result")
    collection = db["initial_assessments"]
    user_doc = await collection.find_one({"user_id": str(user_id)})

    if not user_doc:
        logger.info("No document found, creating new one")
        document = {
            "user_id": str(user_id),
            "assessments": {
                topic.value: {
                    "assessment_completed": True,
                    "assessment_completed_at": datetime.utcnow(),
                    "subcat_scores": subcat_grade,
                    "subcat_priority": subcat_priority,
                    "question_map": []
                }
            },
            "timestamp": datetime.utcnow()
        }
        result = await collection.insert_one(mongo_serialize(document))
        return str(result.inserted_id)

    logger.info("Document exists, proceeding with assessment saving")

    # ALWAYS set completion flags (works for both new & existing topics)
    update_fields = {
        f"assessments.{topic.value}.assessment_completed": True,
        f"assessments.{topic.value}.assessment_completed_at": datetime.utcnow(),
        f"assessments.{topic.value}.subcat_scores": subcat_grade,
        f"assessments.{topic.value}.subcat_priority": subcat_priority,
        "timestamp": datetime.utcnow()
    }

    # Reset question_map only if topic already existed
    if topic.value in user_doc.get("assessments", {}):
        update_fields[f"assessments.{topic.value}.question_map"] = []

    await collection.update_one(
        {"user_id": str(user_id)},
        {"$set": mongo_serialize(update_fields)}
    )

    return str(user_doc["_id"])

async def update_question_list(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    question_list: list[dict],
    collection_name: str = "initial_assessments"
):

    logger.info("Updating permanent question list")

    collection = db[collection_name]

    user_doc = await db_findby_id(db, user_id, collection_name)

    if not user_doc:
        raise Exception(f"No document found for user '{user_id}'")

    await collection.update_one(
        {"user_id": str(user_id)},
        {
            "$set": {
                f"assessments.{topic.value}.question_map": question_list,
                f"assessments.{topic.value}.question_map_updated_at": datetime.utcnow()
            }
        }
    )

    logger.info(f"Updated question list for topic '{topic.value}'")

    return question_list

async def ensure_initial_assessment_doc(
    db: AsyncIOMotorDatabase,
    user_id: UUID
):

    collection = db["initial_assessments"]

    existing = await collection.find_one({"user_id": str(user_id)})
    if existing:
        return existing

    logger.info(f"Initializing initial_assessments for user {user_id}")

    doc = {
        "user_id": str(user_id),
        "assessments": {},
        "progress": {},
        "timestamp": datetime.utcnow()
    }

    await collection.insert_one(doc)
    return doc

async def get_static_asset(redis, key: str, file_path: Path):
    try:
        data = await redis.get(key)
        if data:
            return json.loads(data)

        with open(file_path, "r") as f:
            parsed = json.load(f)

        await redis.set(key, json.dumps(parsed), ex=3600)
        return parsed

    except Exception:
        with open(file_path, "r") as f:
            return json.load(f)

async def db_findby_id(
        db: AsyncIOMotorDatabase,
        user_id: UUID,
        collectionName: str
):
    collection = db[collectionName]
    logger.info(f"finding user {user_id}, collection: {collection}")


    document = await collection.find_one({"user_id": str(user_id)})
    logger.info(f"User: {document}")
    return document


async def load_question_base(topic_value: str):
    try:
        data = await redis.get("static:question_base")

        if data:
            all_topics_data = json.loads(data)
        else:
            logger.warning("Redis cache miss for question base. Reloading from file.")

            with open(ASSETS_DIR / "question_base.json", "r") as f:
                all_topics_data = json.load(f)

            # repopulate redis
            await redis.set(
                "static:question_base",
                json.dumps(all_topics_data),
                ex=3600
            )

    except Exception as e:
        logger.error(f"Redis failure, falling back to file: {e}")

        with open(ASSETS_DIR / "question_base.json", "r") as f:
            all_topics_data = json.load(f)


    qb_questions_by_subcat_key = {}
    for topic_data in all_topics_data:
        logger.info(f"checking topic_data: {topic_data}")
        if topic_data.get("topic") == topic_value:
            logger.info("Found topic!")
            for subtopic in topic_data.get("subtopics", []):
                logger.info(f"subtopic: {subtopic}")
                if "key" in subtopic and "questions" in subtopic:
                    logger.debug(f"checking subtopic: {subtopic}")
                    qb_questions_by_subcat_key[subtopic["key"]] = subtopic["questions"]
            break
    logger.info(f"kb_questions_by_subcat_key: {qb_questions_by_subcat_key}")
    return qb_questions_by_subcat_key

async def fetch_knowledge_list(
        topic: str,
        questions: list[dict]
) -> list[dict]:

    try:
        data = await redis.get("static:knowledge_base")

        if data:
            all_knowledge_data = json.loads(data)
        else:
            logger.warning("Redis cache miss for knowledge base. Reloading.")

            with open(ASSETS_DIR / "knowledge_base.json", "r") as f:
                all_knowledge_data = json.load(f)

            await redis.set(
                "static:knowledge_base",
                json.dumps(all_knowledge_data),
                ex=3600
            )

    except Exception as e:
        logger.error(f"Redis failure, fallback to file: {e}")

        with open(ASSETS_DIR / "knowledge_base.json", "r") as f:
            all_knowledge_data = json.load(f)
    # unanswered question ids
    question_ids = {q["question_id"] for q in questions}

    knowledge_list = []

    for topic_block in all_knowledge_data:
        if topic_block["topic"] != topic:
            continue

        for subtopic in topic_block.get("subtopics", []):
            for kp in subtopic.get("knowledge_points", []):
                if kp["question_id"] in question_ids:
                    knowledge_list.append({
                        "topic": topic_block["topic"],
                        "subtopic": subtopic["name"],
                        "subtopic_key": subtopic["key"],
                        "question_id": kp["question_id"],
                        "knowledge_id": kp["knowledge_id"],
                        "knowledge_content": kp["knowledge_content"],
                    })

    logger.debug(f"Flattened knowledge list: {knowledge_list}")
    return knowledge_list




async def generate_question_list(
        db: AsyncIOMotorDatabase,
        user_id: UUID,
        topic: Topics,
        collectionName: str = None

):
    if collectionName is None:
        collectionName = "initial_assessments"
    logger.info("Generating question list")
    question_map = []
    QUESTIONS_PER_PRIORITY = {
        "HIGH": 3,
        "MODERATE": 2,
        "LOW": 1
    }

    qb_questions = await load_question_base(topic.value)
    logger.info(f"kb_questions: {qb_questions}")
    if not qb_questions:
        logger.error(f"No questions found for topic '{topic.value}' in knowledge base.")
        return []

    try:
        user_document_response = await db_findby_id(db, user_id, collectionName)
        logger.info(f"found document: {user_document_response}")
        if not user_document_response:
            logger.warning(f"No document found for user '{user_id}'")
            return []
        user_data = user_document_response

    except Exception as e:
        logger.error(f"Error finding the user document: {e}")
        return []

    assessments = user_data.get("assessments", {})
    topic_assessment = assessments.get(topic.value)
    if not topic_assessment:
        logger.warning(f"No assessment data for topic '{topic.value}' for user '{user_id}'")
        return []

    if "question_map" in topic_assessment and topic_assessment["question_map"]:
        logger.info(f"Question map already exists for topic '{topic.value}' — skipping generation.")
        return topic_assessment["question_map"]

    priority_info = topic_assessment.get("subcat_priority", [])
    if len(priority_info) < 2 or not isinstance(priority_info[1], dict):
        logger.error(f"subcat_priority data is malformed for user '{user_id}'")
        return []
    subcat_priorities = priority_info[1]
    selected_ids = set()
    question_map = []
    for subcat_key, priority in subcat_priorities.items():
        num_to_select = QUESTIONS_PER_PRIORITY.get(priority.upper(), 1)

        # Get the available questions for this subtopic from the loaded knowledge base
        available_questions = qb_questions.get(subcat_key)

        if available_questions:
            actual_num_to_select = min(num_to_select, len(available_questions))

            unique_pool = [
                q for q in available_questions
                if q.get("question_id") not in selected_ids
            ]

            actual_num_to_select = min(num_to_select, len(unique_pool))

            selected_questions = random.sample(unique_pool, actual_num_to_select)

            for q in selected_questions:
                question_map.append(q)
                selected_ids.add(q.get("question_id"))

            logger.debug(f"Selected {len(selected_questions)} questions for subtopic '{subcat_key}'.")
        else:
            logger.warning(f"Subtopic key '{subcat_key}' not found in knowledge base for topic '{topic.value}'.")



    MIN_TOTAL_QUESTIONS = int(os.getenv("MIN_TOTAL_QUESTIONS", 6))
    MIN_TOTAL_QUESTIONS = max(6, min(MIN_TOTAL_QUESTIONS, 15))

    # If below minimum, fill more from priority order
    if len(question_map) < MIN_TOTAL_QUESTIONS:

        logger.info("Applying global minimum enforcement")

        # Track already selected IDs
        selected_ids = {q["question_id"] for q in question_map}

        # Sort subcategories
        priority_order = ["HIGH", "MODERATE", "LOW"]

        for level in priority_order:
            for subcat_key, priority in subcat_priorities.items():

                if priority.upper() != level:
                    continue

                available_questions = qb_questions.get(subcat_key, [])

                # Filter out already selected
                remaining_questions = [
                    q for q in available_questions
                    if q["question_id"] not in selected_ids
                ]

                for q in remaining_questions:
                    if len(question_map) >= MIN_TOTAL_QUESTIONS:
                        break

                    question_map.append(q)
                    selected_ids.add(q["question_id"])

            if len(question_map) >= MIN_TOTAL_QUESTIONS:
                break

    random.shuffle(question_map)
    logger.info(f"Generated a final list of {len(question_map)} questions.")

    return question_map


async def build_sfb_progression(question_map: list[dict]):
    logger.info("Building SFB progression structure")

    ZONE_1_MAX = 2
    ZONE_2_MAX = 4

    updated_questions = []
    for index, question in enumerate(question_map):
        zone = 3

        if index < ZONE_1_MAX:
            zone = 1
        elif index < ZONE_1_MAX + ZONE_2_MAX:
            zone = 2

        updated_question = {
            **question,

            "zone": zone,
            "zone_order": index + 1,
        }
        updated_questions.append(updated_question)
    return updated_questions


async def build_ps_progression(question_map: list[dict]):
    logger.info("Building Password Security progression structure")

    if all(
        int(question.get("zone", 0)) in {1, 2, 3, 4}
        for question in question_map
    ):
        return question_map

    zone_capacities = (2, 2, 2)
    updated_questions = []

    for index, question in enumerate(question_map):
        if index < zone_capacities[0]:
            zone = 1
        elif index < sum(zone_capacities[:2]):
            zone = 2
        elif index < sum(zone_capacities):
            zone = 3
        else:
            zone = 4

        updated_questions.append({
            **question,
            "zone": zone,
            "zone_order": index + 1,
        })

    return updated_questions


async def save_assessment_question_result(
        db: AsyncIOMotorDatabase,
        user_id: UUID,
        question_map,
        topic: Topics,
        collection_name: str
):
    logger.info("Updating document")
    collection = db[collection_name]

    logger.info("Finding user document")
    user_doc = await db_findby_id(db, user_id, collection_name)
    update_document = None
    if not user_doc:
        logger.error(f"No document found for user '{user_id}'")
        raise Exception(f"No document found for user '{user_id}'")

    try:
        logger.info("Updating document - adding question map")
        update_document = await collection.update_one(
            {"user_id": str(user_id)},  # ✅ convert UUID to str
            {
                "$set": {
                    f"assessments.{topic.value}.question_map": question_map  # ✅ fix syntax
                }
            }
        )
    except Exception as e:
        logger.error(f"Error updating document for topic '{topic.value}': {e}")

    return question_map

async def get_qmap(
        db: AsyncIOMotorDatabase,
        user_id: UUID,
        topic: Topics,
        collection_name: str
):
    logger.info("Getting Document")

    user_doc = await db_findby_id(db, user_id, collection_name)

    if not user_doc:
        logger.error(f"No document found for user '{user_id}'")
        raise Exception(f"No document found for user '{user_id}'")

    topic_key = normalize_topic(topic)
    try:

        question_map = user_doc["assessments"][topic_key]["question_map"]

        return question_map
    except Exception as e:
        logger.error(f"Error finding questionmap'{topic_key}': {e}")


def normalize_topic(topic: Topics | str) -> str:
    return topic.value if isinstance(topic, Topics) else topic



async def check_user_progression(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
):
    logger.info(f"Checking User Progression: (user_id) {user_id}")
    collections = await db.list_collection_names()
    if "progress" not in collections:
        await db["progress"].insert_one({
            "user_id": str(user_id),
            "created_at": datetime.utcnow(),
            "progress": {}
        })
    else:
        existing = await db["progress"].find_one({"user_id": str(user_id)})
        if not existing:
            await db["progress"].insert_one({
                "user_id": str(user_id),
                "created_at": datetime.utcnow(),
                "progress": {}
            })


async def answer_cross_check (
        db: AsyncIOMotorDatabase,
        topic: Topics,
        question_id: str,
        user_answer: str,
        user_id: UUID
):
        collection_name = "initial_assessments"

        q_map = await get_qmap(db, user_id, topic, collection_name)

        logger.info(
            f'FINDING: topic: {topic}, question_id: {question_id}, user_answer: {user_answer}'
        )

        question_found = None
        for question in q_map:
            logger.info(f'checking question: {question}')

            if question["question_id"] == question_id:
                question_found = question
                logger.info('Question found')
                break

        if question_found:
            if user_answer == question_found["answer"]:
                return True
            else:
                return False



async def save_popup_question_result(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    responseItem: SingleResponseItem,
    collection_name: str
):
    logger.info("saving question result")
    await check_user_progression(db, user_id)

    topic_key = topic.value if hasattr(topic, "value") else topic

    progression_doc = await db_findby_id(db, user_id, collection_name)

    if progression_doc is None:
        progression_doc = {
            "user_id": str(user_id),
            "progress": {}
        }
        await db[collection_name].insert_one(progression_doc)

    q_id = responseItem.question_id
    q_subtopic = responseItem.question_subtopic
    q_answer = responseItem.answer
    q_is_correct = responseItem.is_correct

    cross_check_result = await answer_cross_check(db, topic, q_id, q_answer, user_id)
    logger.info(f"cross check result: {cross_check_result}")

    if cross_check_result != q_is_correct:
        raise Exception("inconsistent answers between Frontend and Backend")

    # ✅ Ensure topic container exists
    if topic_key not in progression_doc.get("progress", {}):
        await db[collection_name].update_one(
            {"user_id": str(user_id)},
            {
                "$set": {
                    f"progress.{topic_key}": {
                        "answers": [],
                        "level_completed": False,
                        "level_completed_at": None
                    }
                }
            }
        )

    exists = await db[collection_name].find_one(
        {
            "user_id": str(user_id),
            f"progress.{topic_key}.answers.question_id": q_id
        }
    )

    payload_dict = {
        "question_id": q_id,
        "question_subtopic": q_subtopic,
        "answer": q_answer,
        "is_correct": q_is_correct,
        "timestamp": responseItem.timestamp
    }

    if exists:
        logger.info(
            f"First answer already recorded for question '{q_id}'. "
            "Ignoring retry answer."
        )
        return {
            "saved": False,
            "reason": "first_answer_already_recorded"
        }

    await db[collection_name].update_one(
        {"user_id": str(user_id)},
        {"$push": {f"progress.{topic_key}.answers": payload_dict}}
    )

    return {
        "saved": True,
        "question_id": q_id
    }


async def filter_unanswered_questions(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    question_map: list[dict]
) -> list[dict]:
    progress_doc = await db["progress"].find_one(
        {"user_id": str(user_id)}
    )

    if not progress_doc:
        return question_map

    topic_key = topic.value if hasattr(topic, "value") else topic

    topic_progress = (
        progress_doc
        .get("progress", {})
        .get(topic_key, {})
    )

    # SFB retries are zone-based. All questions in the current and
    # future zones must remain available regardless of first answers.
    if topic_key == Topics.SFB_T.value:
        current_zone = topic_progress.get("current_zone", 1)

        return [
            question
            for question in question_map
            if int(question.get("zone", 1)) >= current_zone
        ]

    answered_ids = {
        answer.get("question_id")
        for answer in topic_progress.get("answers", [])
        if answer.get("question_id")
    }

    return [
        question
        for question in question_map
        if question.get("question_id") not in answered_ids
    ]

async def mark_level_completed(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics
):
    await db["progress"].update_one(
        {"user_id": str(user_id)},
        {
            "$set": {
                f"progress.{topic}.level_completed": True,
                f"progress.{topic}.level_completed_at": datetime.utcnow()
            }
        }
    )

async def get_soc_engineering_grade(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
):
    try:
        topic_key = Topics.SE_T.value

        document = await db["progress"].find_one(
            {"user_id": str(user_id)},
            {
                f"progress.{topic_key}.trust": 1
            }
        )

        return document

    except Exception as e:
        logger.error(f"Error fetching SE grade: {e}")
        raise


async def create_soc_engineering_progress(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
):
    try:
        topic_key = Topics.SE_T.value

        await db["progress"].update_one(
            {"user_id": str(user_id)},
            {
                "$set": {
                    f"progress.{topic_key}.trust": {
                        "grade": 100,
                        "updated_at": datetime.utcnow()
                    }
                }
            },
            upsert=True
        )

    except Exception as e:
        logger.error(f"Error creating SE progress: {e}")
        raise

async def update_soc_engineering_grade(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    is_success: bool,
):
    topic_key = Topics.SE_T.value

    document = await db["progress"].find_one(
        {"user_id": str(user_id)}
    )

    if document is None:
        await create_soc_engineering_progress(db, user_id)
        document = await db["progress"].find_one(
            {"user_id": str(user_id)}
        )

    current_grade = (
        document.get("progress", {})
        .get(topic_key, {})
        .get("trust", {})
        .get("grade", 100)
    )

    if is_success:
        updated_grade = current_grade
    else:
        updated_grade = current_grade - 20

    updated_grade = max(0, updated_grade)

    await db["progress"].update_one(
        {"user_id": str(user_id)},
        {
            "$set": {
                f"progress.{topic_key}.trust.grade": updated_grade,
                f"progress.{topic_key}.trust.updated_at": datetime.utcnow(),
            }
        }
    )

    return updated_grade



def interpret_trust(grade: int) -> str:
    if grade >= 80:
        return "Secure"
    elif grade >= 50:
        return "At Risk"
    else:
        return "Compromised"

DIFFICULTY_WEIGHTS = {
    "easy": 1,
    "medium": 2,
    "hard": 3
}

def compute_knowledge_score(question_map, topic_progress_answers):

    if not topic_progress_answers:
        return 0

    weighted_correct = 0
    total_weight = 0

    for answer in topic_progress_answers:

        question_id = answer["question_id"]
        is_correct = answer["is_correct"]

        # Find matching question
        question = None
        for q in question_map:
            if q["question_id"] == question_id:
                question = q
                break

        if not question:
            continue

        difficulty = question.get("difficulty", "easy")
        weight = DIFFICULTY_WEIGHTS.get(difficulty, 1)

        total_weight += weight

        if is_correct:
            weighted_correct += weight

    if total_weight == 0:
        return 0

    return round((weighted_correct / total_weight) * 100, 2)

async def compute_topic_score(db, user_id, topic, question_map):

    progress_doc = await db["progress"].find_one({"user_id": str(user_id)})

    if not progress_doc:
        return 0

    topic_progress = (
        progress_doc
        .get("progress", {})
        .get(topic.value, {})
        .get("answers", [])
    )

    return compute_knowledge_score(question_map, topic_progress)

async def compute_overall_score(db, user_id, topic_question_maps):

    progress_doc = await db["progress"].find_one({"user_id": str(user_id)})
    if not progress_doc:
        return 0

    progress_data = progress_doc.get("progress", {})

    weighted_correct = 0
    total_weight = 0

    for topic_key, question_map in topic_question_maps.items():

        # Normalize topic key if Enum was passed
        topic_key = topic_key.value if hasattr(topic_key, "value") else topic_key

        topic_progress = (
            progress_data
            .get(topic_key, {})
            .get("answers", [])
        )

        if not topic_progress:
            continue

        # 🔥 O(1) lookup instead of nested loop
        question_lookup = {
            q["question_id"]: q for q in question_map
        }

        for answer in topic_progress:

            question = question_lookup.get(answer.get("question_id"))
            if not question:
                continue

            difficulty = question.get("difficulty", "easy")
            weight = DIFFICULTY_WEIGHTS.get(difficulty, 1)

            total_weight += weight

            if answer.get("is_correct"):
                weighted_correct += weight

    if total_weight == 0:
        return 0

    return round((weighted_correct / total_weight) * 100, 2)

async def update_current_zone_service(
    db: AsyncIOMotorDatabase,
    userid: str,
    topic: str,
    current_zone: int,
    unlocked_zone: int
):

    result = await db.progress.update_one(
        {"user_id": userid},
        {
            "$set": {
                f"progress.{topic}.current_zone":
                    current_zone,

                f"progress.{topic}.unlocked_zone":
                    unlocked_zone,

                f"progress.{topic}.updated_at":
                    datetime.utcnow()
            }
        },
        upsert=True
    )

    return {
        "updated": result.modified_count
    }

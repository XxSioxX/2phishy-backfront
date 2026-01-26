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

logger = get_logger()

REPO_ROOT = Path(__file__).resolve().parents[6]
ASSETS_DIR = REPO_ROOT / "2phishy-backfront"  / "2Phishy" / "assets"

def map_subtopic_to_enum(subtopic_str: str) -> Subtopic:
    try:
        return Subtopic[subtopic_str.upper()]
    except KeyError:
        logger.error(f"Invalid subtopic: {subtopic_str}")
        raise ValueError(f"Invalid subtopic: {subtopic_str}")


def evaluate_assessment(response, evaluator: LearningEvaluator):
    json_path = ASSETS_DIR / "initial_assessment.json"

    logger.info(f"Evaluating assessment from file path: {json_path}")

    question_map = evaluator.build_question_map(json_path)
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

    logger.info(f"DEBUG: {assessment_result} ")
    for question_id, (subtopic, is_correct) in assessment_result.items():
        logger.info(f"Current: {question_id} -> {subtopic}, {is_correct}")
        subtopic_scores[subtopic]["total"] += 1
        if is_correct:
            subtopic_scores[subtopic]["correct"] += 1

    return {
        subtopic: round(scores["correct"] / scores["total"], 2)
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
        {"user_id": str(user_id), f"assessments.{topic.value}": {"$exists": True}}
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

    logger.debug(f"user debug: {user_doc}")

    if not user_doc:
        logger.info("No document found, creating new one")
        document = {
            "user_id": str(user_id),
            "assessments": {
                topic.value: {
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
    # If the topic already exists under assessments, update it
    if topic.value in user_doc.get("assessments", {}):
        logger.info("Topic already exists, updating its subcategories and priority")
        update_fields = {
            f"assessments.{topic.value}.subcat_scores": subcat_grade,
            f"assessments.{topic.value}.subcat_priority": subcat_priority,
            f"assessments.{topic.value}.question_map": []
        }
        update_fields["timestamp"] = datetime.utcnow()
        await collection.update_one({"user_id": str(user_id)}, {"$set": mongo_serialize(update_fields)})
        return str(user_doc["_id"])

    # Otherwise, add a new topic under assessments
    update = {
        f"assessments.{topic.value}": {
            "subcat_scores": subcat_grade,
            "subcat_priority": subcat_priority,
            "question_map": []
        },
        "timestamp": datetime.utcnow()
    }

    update = mongo_serialize(update)
    logger.info(f"Updating records{update}")
    await collection.update_one({"user_id": str(user_id)}, {"$set": update})
    return str(user_doc["_id"])

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


def load_question_base(topic_value: str):

    QUESTION_BASE_PATH = ASSETS_DIR / "question_base.json"

    logger.info("preparing question base")
    try:
        with open(QUESTION_BASE_PATH, "r") as f:
            all_topics_data = json.load(f)

            logger.info(f"Loaded question base (first 2 topics): {all_topics_data[:2]}")

    except Exception as e:
        logger.error(f"Failed to load or parse question_base.json: {e}")
        return {}

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

    KNOWLEDGE_BASE_PATH = ASSETS_DIR / "knowledge_base.json"
    logger.info("fetching knowledge base")

    try:
        with open(KNOWLEDGE_BASE_PATH, "r") as f:
            all_knowledge_data = json.load(f)

    except Exception as e:
        logger.error(f"Failed to load or parse knowledge_base.json: {e}")
        return []

    # collect question_ids
    question_ids = {q["question_id"] for q in questions}

    logger.debug(f"question_ids: {question_ids}")

    # derive subtopics from question_id
    subtopics = set()
    for q in questions:
        qid = q["question_id"]
        if "_svns_" in qid or "_secvsnonsec_" in qid:
            subtopics.add("SECVSNONSEC")
        elif "_https_" in qid:
            subtopics.add("HTTPVSHTTPS")
        elif "_bsbp_" in qid:
            subtopics.add("BROWSERSECBP")

    knowledge_list = []


    for topic_block in all_knowledge_data:
        if topic_block["topic"] != topic:
            continue

        for subtopic in topic_block.get("subtopics", []):
            matched_points = []

            for kp in subtopic.get("knowledge_points", []):
                if kp["question_id"] in question_ids:
                    matched_points.append(kp)

            if matched_points:
                knowledge_list.append({
                    "topic": topic_block["topic"],
                    "subtopic": subtopic["name"],
                    "subtopic_key": subtopic["key"],
                    "knowledge_points": matched_points
                })

    logger.debug(f"knowledge_list: {knowledge_list}")
    return knowledge_list




async def generate_question_list(
        db: AsyncIOMotorDatabase,
        user_id: UUID,
        topic: Topics,
        collectionName: str

):
    logger.info("Generating question list")
    question_map = []
    QUESTIONS_PER_PRIORITY = {
        "HIGH": 3,
        "MODERATE": 2,
        "LOW": 1
    }

    qb_questions = load_question_base(topic.value)
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

    question_map = []
    for subcat_key, priority in subcat_priorities.items():
        num_to_select = QUESTIONS_PER_PRIORITY.get(priority.upper(), 1)

        # Get the available questions for this subtopic from the loaded knowledge base
        available_questions = qb_questions.get(subcat_key)

        if available_questions:
            # Ensure we don't try to select more than what's available
            actual_num_to_select = min(num_to_select, len(available_questions))

            # Use random.sample() to pick unique random questions
            selected_questions = random.sample(available_questions, actual_num_to_select)

            # Add the selected question objects (dictionaries) to our final list
            question_map.extend(selected_questions)
            logger.debug(f"Selected {len(selected_questions)} questions for subtopic '{subcat_key}'.")
        else:
            logger.warning(f"Subtopic key '{subcat_key}' not found in knowledge base for topic '{topic.value}'.")

    # Shuffle the final list to mix questions from different subtopics
    random.shuffle(question_map)
    logger.info(f"Generated a final list of {len(question_map)} questions.")

    return question_map


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

    if topic not in progression_doc.get("progress", {}):
        await db[collection_name].update_one(
            {"user_id": str(user_id)},
            {"$set": {f"progress.{topic}": []}}
        )

    exists = await db[collection_name].find_one(
        {
            "user_id": str(user_id),
            f"progress.{topic}.question_id": q_id
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
        await db[collection_name].update_one(
            {
                "user_id": str(user_id),
                f"progress.{topic}.question_id": q_id
            },
            {
                "$set": {
                    f"progress.{topic}.$.answer": q_answer,
                    f"progress.{topic}.$.is_correct": q_is_correct,
                    f"progress.{topic}.$.timestamp": responseItem.timestamp,
                }
            }
        )
    else:
        await db[collection_name].update_one(
            {"user_id": str(user_id)},
            {"$push": {f"progress.{topic}": payload_dict}}
        )

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

    topic_progress = progress_doc.get("progress", {}).get(topic.value, [])
    answered_ids = {
        q.get("question_id")
        for q in topic_progress
        if "question_id" in q
    }

    return [
        q for q in question_map
        if q.get("question_id") not in answered_ids
    ]
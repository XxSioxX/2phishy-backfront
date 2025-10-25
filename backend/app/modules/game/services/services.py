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


logger = get_logger()

def map_subtopic_to_enum(subtopic_str: str) -> Subtopic:
    """
    Map the subtopic string to the corresponding Subtopic enum.
    """
    try:
        # Convert the subtopic string to enum using .__getattr__()
        return Subtopic[subtopic_str.upper()]
    except KeyError:
        # Handle cases where subtopic string does not match enum keys
        logger.error(f"Invalid subtopic: {subtopic_str}")
        raise ValueError(f"Invalid subtopic: {subtopic_str}")


def evaluate_assessment(response, evaluator: LearningEvaluator):
    data_path = "app/data/initial_assessment.json"
    logger.info(f"Evaluating assessment from file path: {data_path}")

    question_map = evaluator.build_question_map(data_path)
    logger.info(f"Loaded question map with {len(question_map)} questions")

    question_ids = ["safebrowsing", "passsec", "malware", "socialengineering", "incidentresponse"]
    logger.info(f"Evaluating assessment with response: {response}")

    try:
        result_dict = {}

        for item in response.responses:
            q_id = item.question_id
            subtopic_enum = item.question_subtopic
            prefix = q_id.split("-")[0]
            logger.info(f"DEBUG PREFIX: {prefix}")
            if prefix in question_ids:
                try:
                    result = evaluator.evaluate_answer(item, question_map)
                    logger.info(f"RESULT: {result}")
                    result_dict[q_id] = (subtopic_enum, result)
                except ValueError:

                    result_dict[q_id] = "Invalid subtopic"
            else:
                result_dict[q_id] = "Invalid prefix"
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

    # Calculate accuracy per subtopic
    return {
        subtopic: round(scores["correct"] / scores["total"], 2)
        for subtopic, scores in subtopic_scores.items()
    }
    #example output:
    #   {
    #     "SECVSNONSEC": 0.5,        # 1 correct out of 2
    #     "HTTPVSHTTPS": 1.0,        # 2 correct out of 2
    #     "BROWSERSECBP": 0.0        # 0 correct out of 1
    # }

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


async def save_assessment_result(
    db: AsyncIOMotorDatabase,
    user_id: UUID,
    topic: Topics,
    subcat_grade: dict,
    subcat_priority: list
):
    collection = db["initial_assessments"]
    user_doc = await collection.find_one({"user_id": str(user_id)})

    if not user_doc:
        logger.info("No document found, creating new one")
        document = {
            "user_id": str(user_id),
            "assessments": {
                topic.value: {
                    "subcat_scores": subcat_grade,
                    "subcat_priority": subcat_priority
                }
            },
            "timestamp": datetime.utcnow()
        }
        result = await collection.insert_one(mongo_serialize(document))
        return str(result.inserted_id)

    logger.info("Document exists, proceeding with assessment saving")
    # Document exists, check if topic already present
    if topic.value in user_doc.get("assessments", {}):
        logger.info("Checking if assessment record exists")
        # Check if any subtopic already assessed
        existing_subcats = user_doc["assessments"][topic.value]["subcat_scores"].keys()
        for subtopic in subcat_grade:
            subtopic_key = subtopic if isinstance(subtopic, str) else subtopic.value
            if subtopic_key in existing_subcats:
                raise ValueError(f"Subtopic '{subtopic_key}' already assessed for this user.")

        # No duplicate subtopics; add new subcats under this topic (if partial new)
        # But since topic exists, it means assessments are already present, this case might be rare
        # You can merge if needed here, or simply raise to prevent partial updates

        raise ValueError(f"Topic '{topic.value}' already assessed for this user.")

    update = {
        f"assessments.{topic.value}": {
            "subcat_scores": subcat_grade,
            "subcat_priority": subcat_priority
        },
        "timestamp": datetime.utcnow()
    }

    update = mongo_serialize(update)
    logger.info(f"Updating records{update}")
    await collection.update_one({"user_id": str(user_id)}, {"$set": update})
    return str(user_doc["_id"])

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


def load_and_prepare_knowledge_base(topic_value: str):
    """
    Loads knowledge_base.json and returns a dictionary of questions
    organized by subcategory key for a specific topic.
    """
    data_path = "app/data/knowledge_base.json"
    logger.info("preparing knowledge base")
    try:
        with open(data_path, "r") as f:
            all_topics_data = json.load(f)

            logger.info(f"Loaded knowledgebase: {all_topics_data}")
    except Exception as e:
        logger.error(f"Failed to load or parse knowledge_base.json: {e}")
        return {}

    kb_questions_by_subcat_key = {}
    for topic_data in all_topics_data:
        logger.info(f"checking topic_data: {topic_data}")
        if topic_data.get("topic") == topic_value:
            logger.info("Found topic!")
            for subtopic in topic_data.get("subtopics", []):
                logger.info(f"subtopic: {subtopic}")
                if "key" in subtopic and "questions" in subtopic:
                    logger.debug(f"checking subtopic: {subtopic}")
                    kb_questions_by_subcat_key[subtopic["key"]] = subtopic["questions"]
            break
    logger.info(f"kb_questions_by_subcat_key: {kb_questions_by_subcat_key}")
    return kb_questions_by_subcat_key

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

    kb_questions = load_and_prepare_knowledge_base(topic.value)
    logger.info(f"kb_questions: {kb_questions}")
    if not kb_questions:
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
        available_questions = kb_questions.get(subcat_key)

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


async def save_question_result(
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

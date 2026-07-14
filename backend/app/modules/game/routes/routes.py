from typing import Dict, Any, List
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, status, Response, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.game.schemas.gameschemas import (
    InitialAssessmentRequest,
    InitialAssessmentResponseItems,
    GetUser,
    GetUserTopic,
    SingleResponseItem,
    TopicCompletionRequest,
    UpdateQuestionListRequest,
    GameplayMetricRequest,
    SocEngineeringSubmit
)
from app.modules.game.services.services import (
    evaluate_assessment,
    evaluate_subcat_grade,
    save_assessment_result,
    db_findby_id,
    generate_question_list,
    update_question_list,
    save_popup_question_result,
    save_assessment_question_result,
    ensure_initial_assessment_doc,
    filter_unanswered_questions,
    fetch_knowledge_list,
    update_soc_engineering_grade,
    interpret_trust,
    compute_topic_score,
    compute_overall_score,
    compute_knowledge_score,
    build_sfb_progression,
    build_ps_progression,
    build_ir_progression,
    update_current_zone_service,
)
from app.modules.game.services import level_skill_scoring
from app.modules.learning_path.services.learn_path_service import DefaultLearningEvaluator

from app.utils.logger import get_logger
from app.core.database_mongo import get_mongo_db
from app.core.database_postgres import get_db
from app.core.standard_response import StandardResponse
from sqlalchemy.orm import Session
from app.modules.auth.services.auth_service import require_admin_role
from app.modules.user.models.user import User

from datetime import datetime

from app.modules.learning_path.models.learn_path import Topics

router = APIRouter(prefix="/game", tags=["game"])
logger = get_logger(__name__)
evaluator = DefaultLearningEvaluator()


def _iter_topic_answers(progress_data: Dict[str, Any]):
    for topic_name, topic_data in progress_data.items():
        if not isinstance(topic_data, dict):
            continue

        answers = topic_data.get("answers", [])
        if not isinstance(answers, list):
            continue

        yield topic_name, [
            answer for answer in answers
            if isinstance(answer, dict)
        ]


def _latest_answer_timestamp(answers: List[Dict[str, Any]]):
    latest = None
    for answer in answers:
        timestamp = answer.get("timestamp")
        if timestamp is None:
            continue
        if latest is None or str(timestamp) > str(latest):
            latest = timestamp
    return latest


def _avatar_url(username: str) -> str:
    return (
        "https://ui-avatars.com/api/"
        f"?name={quote(username)}&background=4f46e5&color=ffffff&size=40&bold=true"
    )


def _user_avatar_url(user: User, size: int = 40) -> str:
    stored_avatar = getattr(user, "avatar_url", None)
    if stored_avatar:
        return stored_avatar
    return (
        "https://ui-avatars.com/api/"
        f"?name={quote(user.username)}&background=4f46e5&color=ffffff&size={size}&bold=true"
    )


LEVEL_SKILL_CONFIGS = [
    {
        "topic": Topics.SFB_T.value,
        "label": "Safe Browsing",
        "progress_target": 4,
        "metrics_used": [
            "question accuracy",
            "zone progress",
            "trap hits",
            "zone failures",
            "level completion",
        ],
        "info": (
            "Safe Browsing weighs quiz accuracy, cleared zones, malicious-link "
            "trap hits, failed zones, and completion."
        ),
    },
    {
        "topic": Topics.PS_T.value,
        "label": "Password Security",
        "progress_target": 5,
        "metrics_used": [
            "question accuracy",
            "boss progress",
            "password challenge success rate",
            "MFA decisions",
            "level completion",
        ],
        "info": (
            "Password Security weighs quiz accuracy, guardian progress, fictional "
            "password challenge attempts, MFA decisions, and completion."
        ),
    },
    {
        "topic": Topics.M_T.value,
        "label": "Malware",
        "progress_target": 1,
        "metrics_used": [
            "question accuracy",
            "malware cleanup results",
            "damage taken",
            "system resets",
            "level completion",
        ],
        "info": (
            "Malware weighs quiz accuracy, cleanup success, damage taken from "
            "threats, system resets, and completion."
        ),
    },
    {
        "topic": Topics.SE_T.value,
        "label": "Social Engineering",
        "progress_target": 1,
        "metrics_used": [
            "trust grade",
            "dialogue success rate",
            "question accuracy",
            "level completion",
        ],
        "info": (
            "Social Engineering weighs the existing trust grade, dialogue outcomes, "
            "any quiz accuracy, and completion."
        ),
    },
    {
        "topic": Topics.IR_T.value,
        "label": "Incident Response",
        "progress_target": 5,
        "metrics_used": [
            "room completion",
            "responder releases",
            "incident report accuracy",
            "witness decisions",
            "final shutdown",
        ],
        "info": (
            "Incident Response weighs completed response rooms, freed responders, "
            "report and witness decisions, damage, final shutdown, and completion."
        ),
    },
]
LEVEL_SKILL_BY_TOPIC = {config["topic"]: config for config in LEVEL_SKILL_CONFIGS}


def _clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def _percentage(part: float, total: float, fallback: float = 0) -> float:
    if total <= 0:
        return fallback
    return _clamp((part / total) * 100)


def _metric(topic_progress: Dict[str, Any], metric: str, fallback: float = 0) -> float:
    metrics = (
        topic_progress
        .get("gameplay", {})
        .get("metrics", {})
    )
    value = metrics.get(metric, fallback) if isinstance(metrics, dict) else fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _topic_metrics(topic_progress: Dict[str, Any]) -> Dict[str, Any]:
    metrics = (
        topic_progress
        .get("gameplay", {})
        .get("metrics", {})
    )
    return metrics if isinstance(metrics, dict) else {}


def _answer_counts(topic_progress: Dict[str, Any]) -> tuple[int, int]:
    answers = topic_progress.get("answers", [])
    if not isinstance(answers, list):
        return 0, 0

    correct = sum(
        1 for answer in answers
        if isinstance(answer, dict) and answer.get("is_correct") is True
    )
    total = sum(1 for answer in answers if isinstance(answer, dict))
    return correct, total


def _progress_score(topic_progress: Dict[str, Any], progress_target: int) -> float:
    if topic_progress.get("level_completed") is True:
        return 100

    if progress_target <= 1:
        return 0

    current_zone = topic_progress.get("current_zone") or 1
    unlocked_zone = topic_progress.get("unlocked_zone") or current_zone

    try:
        reached = max(float(current_zone), float(unlocked_zone))
    except (TypeError, ValueError):
        reached = 1

    return _percentage(reached - 1, progress_target - 1)


def _topic_started(topic_progress: Dict[str, Any]) -> bool:
    if not isinstance(topic_progress, dict) or not topic_progress:
        return False

    if topic_progress.get("level_completed") is True:
        return True

    if topic_progress.get("answers"):
        return True

    if topic_progress.get("current_zone") or topic_progress.get("unlocked_zone"):
        return True

    if topic_progress.get("trust"):
        return True

    return bool(_topic_metrics(topic_progress))


def _safe_round(value: float) -> int:
    return int(round(_clamp(value)))


def _build_skill_detail(
    score: float,
    correct_answers: int,
    total_questions: int,
    gameplay: Dict[str, Any],
    notes: List[str],
) -> Dict[str, Any]:
    return {
        "score": _safe_round(score),
        "correct_answers": correct_answers,
        "total_questions": total_questions,
        "gameplay": gameplay,
        "notes": notes,
    }


def _score_safe_browsing(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = _answer_counts(topic_progress)
    answer_score = _percentage(correct, total)
    zone_score = _progress_score(topic_progress, 4)
    trap_hits = _metric(topic_progress, "trap_hits")
    zone_failures = _metric(topic_progress, "zone_failures")
    wrong_answers = max(total - correct, _metric(topic_progress, "wrong_answers"))
    gameplay_score = _clamp(100 - (trap_hits * 10) - (zone_failures * 8) - (wrong_answers * 4))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.45
        + zone_score * 0.25
        + gameplay_score * 0.20
        + completion_score * 0.10
    )
    detail = _build_skill_detail(
        score,
        correct,
        total,
        {
            "zone_score": _safe_round(zone_score),
            "trap_hits": trap_hits,
            "zone_failures": zone_failures,
            "wrong_answers": wrong_answers,
        },
        ["Lower trap hits and fewer failed zones raise this score."],
    )
    return score, detail


def _score_password_security(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = _answer_counts(topic_progress)
    answer_score = _percentage(correct, total)
    progress_score = _progress_score(topic_progress, 5)
    attempts = _metric(topic_progress, "password_attempts")
    successes = _metric(topic_progress, "password_successes")
    failures = _metric(topic_progress, "password_failures")
    mfa_correct = _metric(topic_progress, "mfa_correct")
    mfa_wrong = _metric(topic_progress, "mfa_wrong")
    challenge_score = _percentage(successes + mfa_correct, attempts + mfa_correct + mfa_wrong, 70)
    penalty = min(35, failures * 5 + mfa_wrong * 10)
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.30
        + progress_score * 0.25
        + _clamp(challenge_score - penalty) * 0.30
        + completion_score * 0.15
    )
    detail = _build_skill_detail(
        score,
        correct,
        total,
        {
            "boss_progress_score": _safe_round(progress_score),
            "password_attempts": attempts,
            "password_successes": successes,
            "password_failures": failures,
            "mfa_correct": mfa_correct,
            "mfa_wrong": mfa_wrong,
        },
        ["Fewer rejected passwords and correct MFA choices raise this score."],
    )
    return score, detail


def _score_malware(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = _answer_counts(topic_progress)
    answer_score = _percentage(correct, total)
    malware_cleaned = _metric(topic_progress, "malware_cleaned")
    cleanup_failed = _metric(topic_progress, "malware_cleanup_failed")
    damage_taken = _metric(topic_progress, "damage_taken")
    system_resets = _metric(topic_progress, "system_resets")
    cleanup_score = _percentage(malware_cleaned, malware_cleaned + cleanup_failed, answer_score)
    survival_score = _clamp(100 - (damage_taken * 6) - (system_resets * 18))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        answer_score * 0.40
        + cleanup_score * 0.25
        + survival_score * 0.20
        + completion_score * 0.15
    )
    detail = _build_skill_detail(
        score,
        correct,
        total,
        {
            "malware_cleaned": malware_cleaned,
            "malware_cleanup_failed": cleanup_failed,
            "damage_taken": damage_taken,
            "system_resets": system_resets,
        },
        ["Correct cleanup and less damage raise this score."],
    )
    return score, detail


def _score_social_engineering(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = _answer_counts(topic_progress)
    answer_score = _percentage(correct, total, 70)
    trust_grade = (
        topic_progress
        .get("trust", {})
        .get("grade")
    )
    try:
        trust_score = _clamp(float(trust_grade))
    except (TypeError, ValueError):
        trust_score = 50

    dialogue_successes = _metric(topic_progress, "dialogue_successes")
    dialogue_failures = _metric(topic_progress, "dialogue_failures")
    dialogue_score = _percentage(
        dialogue_successes,
        dialogue_successes + dialogue_failures,
        trust_score,
    )
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        trust_score * 0.60
        + dialogue_score * 0.25
        + answer_score * 0.10
        + completion_score * 0.05
    )
    detail = _build_skill_detail(
        score,
        correct,
        total,
        {
            "trust_grade": trust_grade,
            "dialogue_successes": dialogue_successes,
            "dialogue_failures": dialogue_failures,
        },
        ["Better dialogue outcomes and higher trust raise this score."],
    )
    return score, detail


def _score_incident_response(topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    correct, total = _answer_counts(topic_progress)
    answer_score = _percentage(correct, total)
    progress_score = _progress_score(topic_progress, 5)
    rooms_completed = _metric(topic_progress, "rooms_completed")
    responders_released = _metric(topic_progress, "responders_released")
    report_correct = _metric(topic_progress, "report_answers_correct")
    report_retries = _metric(topic_progress, "report_retries")
    witness_correct = _metric(topic_progress, "witness_correct")
    witness_wrong = _metric(topic_progress, "witness_wrong")
    damage_taken = _metric(topic_progress, "incident_damage_taken")
    final_shutdown = _metric(topic_progress, "final_shutdown")

    room_score = max(progress_score, _percentage(rooms_completed + responders_released, 8))
    decision_score = _percentage(
        report_correct + witness_correct + final_shutdown,
        report_correct + report_retries + witness_correct + witness_wrong + max(final_shutdown, 1),
        answer_score,
    )
    survival_score = _clamp(100 - (damage_taken * 5))
    completion_score = 100 if topic_progress.get("level_completed") is True else 0
    score = (
        room_score * 0.35
        + decision_score * 0.25
        + answer_score * 0.15
        + survival_score * 0.10
        + completion_score * 0.15
    )
    detail = _build_skill_detail(
        score,
        correct,
        total,
        {
            "rooms_completed": rooms_completed,
            "responders_released": responders_released,
            "report_answers_correct": report_correct,
            "report_retries": report_retries,
            "witness_correct": witness_correct,
            "witness_wrong": witness_wrong,
            "incident_damage_taken": damage_taken,
            "final_shutdown": final_shutdown,
        },
        ["Room progress, responder releases, and accepted reports raise this score."],
    )
    return score, detail


def _calculate_level_skill(topic: str, topic_progress: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    if topic == Topics.SFB_T.value:
        return _score_safe_browsing(topic_progress)
    if topic == Topics.PS_T.value:
        return _score_password_security(topic_progress)
    if topic == Topics.M_T.value:
        return _score_malware(topic_progress)
    if topic == Topics.SE_T.value:
        return _score_social_engineering(topic_progress)
    if topic == Topics.IR_T.value:
        return _score_incident_response(topic_progress)

    correct, total = _answer_counts(topic_progress)
    score = _percentage(correct, total)
    return score, _build_skill_detail(score, correct, total, {}, [])


def _skill_category(score: float | None, started: bool) -> str:
    if not started:
        return "not_started"
    if score is not None and score >= 80:
        return "strong"
    if score is not None and score >= 60:
        return "on_track"
    return "needs_practice"


def _safe_metric_name(metric: str) -> str:
    sanitized = "".join(
        char.lower() if char.isalnum() else "_"
        for char in metric.strip()
    )
    sanitized = "_".join(part for part in sanitized.split("_") if part)
    if not sanitized:
        raise HTTPException(status_code=400, detail="Metric name is required")
    return sanitized[:60]


@router.post(
    "/initassess/",
    response_model=StandardResponse[InitialAssessmentResponseItems],
    status_code=status.HTTP_201_CREATED)
async def initial_assessment_evaluation(
    request: InitialAssessmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = None

):
    logger.info("initial_assessment_evaluation: Evaluating initial assessment")

    grade_dict = await evaluate_assessment(request.assessment_response, evaluator)
    logger.info(f"DEBUG: {grade_dict}")
    subcat_grade = evaluate_subcat_grade(grade_dict)
    subcat_priority = evaluator.evaluate_subcat_priority(request.topic, subcat_grade)
    try:
        logger.info(f"inserting assessment result")
        await ensure_initial_assessment_doc(db, request.userid)
        logger.info("saving assessment result")
        inserted_id = await save_assessment_result(
            db, request.userid, request.topic, subcat_grade, subcat_priority
        )
    except ValueError as e:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message=str(e),
            data=None
        )

    return StandardResponse(
        success=True,
        message="Initial assessment saved successfully.",
        data=InitialAssessmentResponseItems(
            inserted_id=str(inserted_id),
            timestamp=datetime.utcnow(),
            userid=request.userid,
        )
    )

@router.post(
    "/assessment/submit",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK)
async def assessment_submit(
    request: InitialAssessmentResponseItems,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response()
):
    logger.info("Submitting assessment answers...")

    try:
        inserted_items = []
        for item in request:
            save_result = await save_popup_question_result(
                db=db,
                user_id=item.userid,
                topic=item.topic,
                responseItem=item,
                collection_name="progress"
            )

            inserted_items.append(save_result)

        return StandardResponse(
            success=True,
            message="Assessment answers submitted successfully.",
            data={"saved": inserted_items}
        )

    except Exception as e:
        logger.error(f"Error in /assessment/submit: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to submit answers.",
            data=None
        )

@router.post(
    "/question/submit/single",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK)
async def single_question_submit(
        request: SingleResponseItem,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response()
):
    logger.info("Submitting question answers...")

    try:
        user_uuid = request.userid
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}. Must be a valid UUID.")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format. Must be a valid UUID.",
            data=None
        )

    save_result = await save_popup_question_result(
        db=db,
        user_id=request.userid,
        topic=request.topic,
        responseItem=request,
        collection_name="progress"
    )

    return StandardResponse(
        success=True,
        message="Question submitted successfully.",
        data={"saved": save_result}
    )

@router.post(
    "/progress/complete",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def mark_topic_completed(
    request: TopicCompletionRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):
    logger.info(f"Marking topic completed: {request.topic}")

    result = await db.progress.update_one(
        {"user_id": request.userid},
        {
            "$set": {
                f"progress.{request.topic}.level_completed": True,
                f"progress.{request.topic}.level_completed_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return StandardResponse(
        success=True,
        message="Topic marked as completed",
        data={"updated": result.modified_count}
    )

@router.post(
    "/progress/intro-seen",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def mark_intro_seen(
    request: TopicCompletionRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):
    logger.info(f"Marking intro seen for topic: {request.topic}")

    result = await db.progress.update_one(
        {"user_id": request.userid},
        {
            "$set": {
                f"progress.{request.topic}.intro_seen": True,
                f"progress.{request.topic}.intro_seen_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return StandardResponse(
        success=True,
        message="Intro marked as seen",
        data={"updated": result.modified_count}
    )

@router.post(
    "/progress/zone",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def update_current_zone(
    request: dict,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):

    userid = request.get("userid")
    topic = request.get("topic")

    current_zone = request.get("current_zone")
    unlocked_zone = request.get("unlocked_zone")

    if (
        userid is None or
        topic is None or
        current_zone is None or
        unlocked_zone is None
    ):
        raise HTTPException(
            status_code=400,
            detail="Missing required fields"
        )

    result = await update_current_zone_service(
        db=db,
        userid=userid,
        topic=topic,
        current_zone=current_zone,
        unlocked_zone=unlocked_zone
    )

    return StandardResponse(
        success=True,
        message="Current zone updated",
        data=result
    )


@router.post(
    "/progress/gameplay",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    tags=["dashboard analytics"],
    summary="Record a gameplay metric for a level",
    description=(
        "Stores a level-specific gameplay metric under "
        "`progress.<topic>.gameplay.metrics`. The dashboard uses these metrics "
        "with quiz answers, progress, and completion to calculate the Average "
        "Level Skill Score."
    ),
)
async def record_gameplay_metric(
    request: GameplayMetricRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):
    if request.topic not in level_skill_scoring.LEVEL_SKILL_BY_TOPIC:
        raise HTTPException(status_code=400, detail="Unknown gameplay topic")

    try:
        metric = level_skill_scoring.safe_metric_name(request.metric)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    metric_path = f"progress.{request.topic}.gameplay.metrics.{metric}"
    updated_at_path = f"progress.{request.topic}.gameplay.updated_at"
    topic_updated_at_path = f"progress.{request.topic}.updated_at"
    now = datetime.utcnow()

    update_doc: Dict[str, Any] = {
        "$set": {
            updated_at_path: now,
            topic_updated_at_path: now,
        }
    }

    if request.mode == "inc":
        update_doc["$inc"] = {metric_path: request.amount}
    elif request.mode == "max":
        update_doc["$max"] = {metric_path: request.amount}
    else:
        update_doc["$set"][metric_path] = request.amount

    result = await db.progress.update_one(
        {"user_id": request.userid},
        update_doc,
        upsert=True
    )

    return StandardResponse(
        success=True,
        message="Gameplay metric recorded",
        data={
            "updated": result.modified_count,
            "metric": metric,
            "mode": request.mode,
        }
    )


@router.post(
    "/data",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK)
async def get_user_data_from_collection(
        request: GetUser,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/initassess/data. User ID: '{request.userid}', Collection: '{request.collectionName}'.")


    try:
        user_id = request.userid
    except ValueError:
        logger.error(f"Invalid user_id format: {user_id}. Must be a valid UUID.")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format. Must be a valid UUID.",
            data=None
        )

    logger.info("requesting db")
    #If a specific collection is requested > old behavior
    if request.collectionName:
        document = await db_findby_id(db, user_id, request.collectionName)
        if not document:
            response.status_code = status.HTTP_404_NOT_FOUND
            return StandardResponse(False, "Data not found", None)

        document["_id"] = str(document["_id"])
        return StandardResponse(True, "Data retrieved", document)

    # Otherwise > return BOTH
    initial = await db["initial_assessments"].find_one({"user_id": str(user_id)})
    progress = await db["progress"].find_one({"user_id": str(user_id)})

    if initial and "_id" in initial:
        initial["_id"] = str(initial["_id"])
    if progress and "_id" in progress:
        progress["_id"] = str(progress["_id"])

    return StandardResponse(
        success=True,
        message="User progress retrieved",
        data={
            "initial_assessments": initial,
            "progress": progress,
        }
    )

@router.post(
    "/generate/knowledgelist/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def generate_knowledge_list(
        request: GetUserTopic,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response()
):
    logger.info("Fetching knowledge list...")

    user_uuid = ""

    try:
        logger.info("checking user_uuid")
        user_uuid = request.userid
        logger.info(f"User UUID converted")
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}. Must be a valid UUID.")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format. Must be a valid UUID.",
            data=None
        )

    try:
        logger.info("Fetching question list")

        qmap = await generate_question_list(db, user_uuid, request.topic, request.collectionName)

        try:
            if request.topic == Topics.SFB_T:
                qmap = await build_sfb_progression(qmap)
            elif request.topic == Topics.PS_T:
                qmap = await build_ps_progression(qmap)
            elif request.topic == Topics.IR_T:
                qmap = await build_ir_progression(qmap)
        except Exception as e:
            logger.error(f"Error building knowledge progression map: {e}")

        unanswered_qmap = await filter_unanswered_questions(
            db,
            user_uuid,
            request.topic,
            qmap
        )

        logger.info(f"Calling generate_knowledge_list {request.topic, qmap}")
        knowledge = await fetch_knowledge_list(
            request.topic.value if hasattr(request.topic, "value") else request.topic,
            unanswered_qmap
        )

        return StandardResponse(
            success=True,
            message="Knowledge list generated successfully.",
            data={
                "knowledge": knowledge
            }
        )

    except Exception as e:
        logger.error(f"Error in fetching knowledge list: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to fetch knowledge list",
            data=None
        )

@router.post(
    "/generate/qlist/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_201_CREATED
)
async def generate_user_question_list(
        request: GetUserTopic,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/initassess/questions/. user_id: '{request.userid}', Collection: '{request.collectionName}'.")

    user_uuid = ""

    try:
        user_uuid = request.userid
        logger.info(f"User UUID converted")
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}. Must be a valid UUID.")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format. Must be a valid UUID.",
            data=None
        )

    try:
        logger.info("Creating question list")
        qmap = await generate_question_list(db, user_uuid, request.topic, request.collectionName)

        try:
           if request.topic == Topics.SFB_T:
                qmap = await build_sfb_progression(qmap)
           elif request.topic == Topics.PS_T:
                qmap = await build_ps_progression(qmap)
           elif request.topic == Topics.IR_T:
                qmap = await build_ir_progression(qmap)
        except Exception as e:
            logger.error(f"Error in creating question list: {e}")


        logger.info(f"Successfully created question map: {qmap}, proceeding to updating document")

        await save_assessment_question_result(db, user_uuid, qmap, request.topic, request.collectionName)

        logger.info(f"question map: {qmap}")

        unanswered_qmap = await filter_unanswered_questions(
            db,
            user_uuid,
            request.topic,
            qmap
        )

        topic_key = request.topic.value if hasattr(request.topic, "value") else request.topic
        progress_doc = await db["progress"].find_one({"user_id": str(user_uuid)})
        topic_progress = (
            progress_doc
            .get("progress", {})
            .get(topic_key, {})
        ) if progress_doc else {}
        answers = topic_progress.get("answers", [])
        answered_total = len({
            answer.get("question_id")
            for answer in answers
            if answer.get("question_id")
        })
        correct_answered_total = len({
            answer.get("question_id")
            for answer in answers
            if answer.get("question_id") and answer.get("is_correct") is True
        })

        logger.info(f"Remaining Unanswered questions: {unanswered_qmap}")
        logger.info(f"questionsTotal: {len(qmap)}")
        return StandardResponse(
            success=True,
            message="Successfully generated unanswered question list",
            data={
                "questions": unanswered_qmap,
                "questionsTotal": len(unanswered_qmap),
                "questionMapTotal": len(qmap),
                "answeredTotal": answered_total,
                "correctAnsweredTotal": correct_answered_total,
                "levelCompleted": topic_progress.get("level_completed") is True
            }
        )

    except Exception as e:
        logger.error(f"Error in generating user question list: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to generate question list",
            data=None
        )

@router.post(
    "/questionlist/update/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def update_user_question_list(
    request: UpdateQuestionListRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    logger.info("Updating permanent question list")

    try:

        updated_questions = await update_question_list(
            db=db,
            user_id=request.userid,
            topic=request.topic,
            question_list=request.question_list,
            collection_name="initial_assessments"
        )

        return StandardResponse(
            success=True,
            message="Question list updated successfully",
            data={
                "questions": updated_questions
            }
        )

    except Exception as e:
        logger.error(f"Error updating question list: {e}")

        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        return StandardResponse(
            success=False,
            message="Failed to update question list",
            data=None
        )


@router.post(
    "/submit/se-submit/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_201_CREATED
)
async def submit_soc_engineering_grade(
    request: SocEngineeringSubmit,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    try:
        updated_grade = await update_soc_engineering_grade(
            db=db,
            user_id=request.user_id,
            is_success=request.is_success
        )

        return StandardResponse(
            success=True,
            message="SE response recorded successfully.",
            data={
                "updated_grade": updated_grade,
                "trust_level": interpret_trust(updated_grade)
            }
        )

    except Exception as e:
        logger.error(f"Error in generating user question list: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to submit soceng grade",
            data=None
        )

@router.post(
    "/score/topic/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def get_topic_score(
    request: GetUserTopic,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    logger.info("Fetching topic knowledge score...")

    user_uuid = ""

    try:
        user_uuid = request.userid
        logger.info("User UUID validated")
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format.",
            data=None
        )

    try:
        logger.info("Generating question map for scoring")
        qmap = await generate_question_list(
            db, user_uuid, request.topic, request.collectionName
        )

        logger.info("Computing topic score")
        score = await compute_topic_score(
            db, user_uuid, request.topic, qmap
        )

        return StandardResponse(
            success=True,
            message="Topic score computed successfully.",
            data={
                "topic": request.topic.value,
                "knowledge_score": score
            }
        )

    except Exception as e:
        logger.error(f"Error computing topic score: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to compute topic score",
            data=None
        )

@router.post(
    "/score/overall/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def get_overall_score(
    request: GetUserTopic,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    logger.info("Fetching overall knowledge score...")

    user_uuid = ""

    try:
        user_uuid = request.userid
        logger.info("User UUID validated")
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format.",
            data=None
        )

    try:
        logger.info("Collecting question maps for all topics")

        topic_question_maps = {}

        for topic in Topics:
            qmap = await generate_question_list(
                db, user_uuid, topic, request.collectionName
            )
            topic_question_maps[topic.value] = qmap

        logger.info("Computing overall score")
        overall_score = await compute_overall_score(
            db, user_uuid, topic_question_maps
        )

        return StandardResponse(
            success=True,
            message="Overall score computed successfully.",
            data={
                "overall_knowledge_score": overall_score
            }
        )

    except Exception as e:
        logger.error(f"Error computing overall score: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to compute overall score",
            data=None
        )

@router.post(
    "/score/full-profile/",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK
)
async def get_full_security_profile(
    request: GetUserTopic,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    logger.info("Fetching full security profile...")

    user_uuid = ""

    try:
        user_uuid = request.userid
        logger.info("User UUID validated")
    except ValueError:
        logger.error(f"Invalid user_id format: {user_uuid}")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format.",
            data=None
        )

    try:
        topic_scores = {}
        topic_question_maps = {}

        for topic in Topics:
            qmap = await generate_question_list(
                db, user_uuid, topic, request.collectionName
            )
            topic_question_maps[topic.value] = qmap

            score = await compute_topic_score(
                db, user_uuid, topic, qmap
            )

            topic_scores[topic.value] = score

        overall_score = await compute_overall_score(
            db, user_uuid, topic_question_maps
        )

        # Fetch trust score if exists
        progress_doc = await db["progress"].find_one(
            {"user_id": str(user_uuid)}
        )

        trust_data = (
            progress_doc
            .get("progress", {})
            .get("Social Engineering", {})
            .get("trust", {})
        ) if progress_doc else {}

        trust_grade = trust_data.get("grade", None)

        return StandardResponse(
            success=True,
            message="Security profile generated successfully.",
            data={
                "per_topic_scores": topic_scores,
                "overall_knowledge_score": overall_score,
                "trust_grade": trust_grade,
                "trust_level": interpret_trust(trust_grade) if trust_grade is not None else None
            }
        )

    except Exception as e:
        logger.error(f"Error generating security profile: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to generate security profile",
            data=None
        )

@router.get(
    "/score/users/top-scores/",
    response_model=StandardResponse[List[Dict[str, Any]]],
    status_code=status.HTTP_200_OK
)
async def get_top_user_scores(
    limit: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    """Get top user scores (by overall knowledge score) - lightweight version"""
    logger.info(f"Fetching top {limit} user scores...")

    try:
        # Get all progress documents
        progress_docs = await db["progress"].find({}).to_list(None)

        if not progress_docs:
            logger.info("No progress documents found")
            return StandardResponse(
                success=True,
                message="No user scores available",
                data=[]
            )

        user_scores = []

        for doc in progress_docs:
            user_id = doc.get("user_id")
            if not user_id:
                continue

            try:
                progress_data = doc.get("progress", {})
                total_correct = 0
                total_questions = 0

                for topic_name, topic_data in progress_data.items():
                    if isinstance(topic_data, dict):
                        answers = topic_data.get("answers", [])
                        if isinstance(answers, list):
                            for answer_data in answers:
                                if isinstance(answer_data, dict):
                                    total_questions += 1
                                    if answer_data.get("is_correct", False):
                                        total_correct += 1

                score = total_correct
                user_scores.append({
                    "user_id": user_id,
                    "overall_knowledge_score": score
                })
            except Exception as e:
                logger.error(f"Error computing score for user {user_id}: {e}")
                user_scores.append({
                    "user_id": user_id,
                    "overall_knowledge_score": 0
                })
                continue

        user_scores.sort(key=lambda x: x["overall_knowledge_score"], reverse=True)
        top_scores = user_scores[:limit]

        logger.info(f"Successfully retrieved {len(top_scores)} user scores")
        return StandardResponse(
            success=True,
            message=f"Retrieved top {len(top_scores)} user scores",
            data=top_scores
        )

    except Exception as e:
        logger.error(f"Error fetching top user scores: {e}", exc_info=True)
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message=f"Failed to fetch top user scores: {str(e)}",
            data=[]
        )


@router.get(
    "/score/topics/performance/",
    response_model=StandardResponse[List[Dict[str, Any]]],
    status_code=status.HTTP_200_OK
)
async def get_topic_performance(
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    """Get average performance (lowest scores) for each topic across all students - shows where students struggle"""
    logger.info("Fetching topic performance data (where students struggle)...")

    try:
        progress_docs = await db["progress"].find({}).to_list(None)

        if not progress_docs:
            logger.info("No progress documents found")
            return StandardResponse(
                success=True,
                message="No student data available",
                data=[]
            )
        topic_scores = {topic.value: [] for topic in Topics}

        for doc in progress_docs:
            try:
                progress_data = doc.get("progress", {})

                for topic in Topics:
                    topic_name = topic.value
                    topic_data = progress_data.get(topic_name, {})
                    total_correct = 0
                    total_questions = 0

                    answers = topic_data.get("answers", [])
                    if isinstance(answers, list):
                        for answer_data in answers:
                            if isinstance(answer_data, dict):
                                total_questions += 1
                                if answer_data.get("is_correct", False):
                                    total_correct += 1
                    if total_questions > 0:
                        score_percentage = (total_correct / total_questions) * 100
                        topic_scores[topic_name].append(score_percentage)

            except Exception as e:
                logger.warning(f"Error processing user doc: {e}")
                continue

        topic_performance = []
        for topic in Topics:
            topic_name = topic.value
            scores = topic_scores[topic_name]

            if scores:
                avg_score = sum(scores) / len(scores)
            else:
                avg_score = 0

            short_names = {
                "Safe Browsing Practices": "Safe Browsing",
                "Password Security": "Password Security",
                "Malware": "Malware",
                "Social Engineering": "Social Engineering",
                "Incident Response": "Incident Response"
            }

            topic_performance.append({
                "name": short_names.get(topic_name, topic_name),
                "score": round(avg_score, 2)
            })

        # Sort by lowest score first (areas needing most help)
        topic_performance.sort(key=lambda x: x["score"])

        logger.info(f"Successfully calculated performance for {len(topic_performance)} topics")
        return StandardResponse(
            success=True,
            message="Topic performance data retrieved",
            data=topic_performance
        )

    except Exception as e:
        logger.error(f"Error fetching topic performance: {e}", exc_info=True)
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message=f"Failed to fetch topic performance: {str(e)}",
            data=[]
        )


@router.get(
    "/score/users/performance-categories/",
    response_model=StandardResponse[List[Dict[str, Any]]],
    status_code=status.HTTP_200_OK
)
async def get_user_performance_categories(
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response(),
):
    """Get overall student performance category counts for dashboard charts."""
    logger.info("Fetching user performance categories...")

    try:
        progress_docs = await db["progress"].find({}).to_list(None)

        categories = [
            {"name": "Excellent (80-100%)", "value": 0, "color": "#4CAF50"},
            {"name": "Good (60-79%)", "value": 0, "color": "#FFB74D"},
            {"name": "Needs Improvement", "value": 0, "color": "#E57373"},
        ]

        for doc in progress_docs:
            progress_data = doc.get("progress", {})
            if not isinstance(progress_data, dict):
                continue

            total_questions = 0
            correct_answers = 0

            for _, answers in _iter_topic_answers(progress_data):
                total_questions += len(answers)
                correct_answers += sum(
                    1 for answer in answers
                    if answer.get("is_correct") is True
                )

            if total_questions == 0:
                continue

            score = (correct_answers / total_questions) * 100
            if score >= 80:
                categories[0]["value"] += 1
            elif score >= 60:
                categories[1]["value"] += 1
            else:
                categories[2]["value"] += 1

        return StandardResponse(
            success=True,
            message="User performance categories retrieved",
            data=categories
        )

    except Exception as e:
        logger.error(f"Error fetching user performance categories: {e}", exc_info=True)
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message=f"Failed to fetch user performance categories: {str(e)}",
            data=[]
        )


@router.get(
    "/admin/level-skill-performance",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    tags=["dashboard analytics"],
    summary="Get gameplay-aware level skill performance",
    description=(
        "Returns the admin dashboard replacement for Quiz Completion Rate: "
        "overall average score, per-level averages, category counts, users in "
        "each category, and metric explanations for the hoverable info UI."
    ),
)
async def get_level_skill_performance(
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    user_db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role),
    response: Response = Response(),
):
    """Get gameplay-aware per-level skill performance for the admin dashboard."""
    logger.info(f"Admin {current_user.username} fetching level skill performance...")

    try:
        progress_docs = await db["progress"].find({}).to_list(None)
        progress_by_user = {
            str(doc.get("user_id")): doc
            for doc in progress_docs
            if doc.get("user_id") is not None
        }

        users = user_db.query(User).all()
        students = [
            user for user in users
            if getattr(getattr(user, "role", None), "value", user.role) == "student"
        ]

        category_template = [
            {"key": "strong", "label": "Strong", "range": "80-100%", "color": "#4CAF50"},
            {"key": "on_track", "label": "On Track", "range": "60-79%", "color": "#FFB74D"},
            {"key": "needs_practice", "label": "Needs Practice", "range": "0-59%", "color": "#E57373"},
            {"key": "not_started", "label": "Not Started", "range": "No progress", "color": "#7C8AA5"},
        ]

        levels = []
        level_averages = []
        active_user_ids = set()

        for config in level_skill_scoring.LEVEL_SKILL_CONFIGS:
            topic = config["topic"]
            categories = {
                category["key"]: {**category, "count": 0, "users": []}
                for category in category_template
            }
            scored_users = []

            for user in students:
                user_id = str(user.userid)
                progress_doc = progress_by_user.get(user_id, {})
                topic_progress = (
                    progress_doc
                    .get("progress", {})
                    .get(topic, {})
                )
                started = level_skill_scoring.topic_started(topic_progress)
                score = None
                detail = {
                    "score": None,
                    "correct_answers": 0,
                    "total_questions": 0,
                    "gameplay": {},
                    "notes": [],
                }

                if started:
                    active_user_ids.add(user_id)
                    raw_score, detail = level_skill_scoring.calculate_level_skill(topic, topic_progress)
                    score = level_skill_scoring.safe_round(raw_score)
                    scored_users.append(score)

                category_key = level_skill_scoring.skill_category(score, started)
                categories[category_key]["count"] += 1
                categories[category_key]["users"].append({
                    "userid": user_id,
                    "username": user.username,
                    "email": user.email,
                    "avatar_url": _user_avatar_url(user),
                    "score": score,
                    "details": detail,
                })

            average_score = level_skill_scoring.safe_round(sum(scored_users) / len(scored_users)) if scored_users else 0
            if scored_users:
                level_averages.append(average_score)

            levels.append({
                "topic": topic,
                "label": config["label"],
                "average_score": average_score,
                "users_count": len(scored_users),
                "total_users": len(students),
                "metrics_used": config["metrics_used"],
                "info": config["info"],
                "categories": list(categories.values()),
            })

        overall_average = level_skill_scoring.safe_round(sum(level_averages) / len(level_averages)) if level_averages else 0

        return StandardResponse(
            success=True,
            message="Level skill performance retrieved",
            data={
                "average_score": overall_average,
                "users_count": len(active_user_ids),
                "level_attempts_count": sum(level["users_count"] for level in levels),
                "total_users": len(students),
                "levels": levels,
                "metrics_used": [
                    "question accuracy",
                    "level-specific gameplay events",
                    "zone/room progress",
                    "level completion",
                ],
                "info": (
                    "Average Level Skill Score combines quiz answers with each "
                    "level's gameplay mechanics. Not-started users are shown in "
                    "the expanded view but excluded from the average."
                ),
            }
        )

    except Exception as e:
        logger.error(f"Error fetching level skill performance: {e}", exc_info=True)
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message=f"Failed to fetch level skill performance: {str(e)}",
            data={
                "average_score": 0,
                "users_count": 0,
                "total_users": 0,
                "levels": [],
            }
        )


@router.get(
    "/admin/quiz-insights",
    response_model=StandardResponse[List[Dict[str, Any]]],
    status_code=status.HTTP_200_OK
)
async def get_quiz_insights(
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    user_db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role),
    response: Response = Response(),
):
    """Get per-user, per-topic quiz insight rows for admins."""
    logger.info(f"Admin {current_user.username} fetching quiz insights...")

    try:
        progress_docs = await db["progress"].find({}).to_list(None)
        users = user_db.query(User).all()
        user_by_id = {str(user.userid): user for user in users}

        insights = []
        for doc in progress_docs:
            user_id = str(doc.get("user_id", ""))
            user = user_by_id.get(user_id)
            username = user.username if user else "Unknown User"
            progress_data = doc.get("progress", {})

            if not isinstance(progress_data, dict):
                continue

            for topic_name, answers in _iter_topic_answers(progress_data):
                total_questions = len(answers)
                if total_questions == 0:
                    continue

                correct_answers = sum(
                    1 for answer in answers
                    if answer.get("is_correct") is True
                )
                score = round((correct_answers / total_questions) * 100)

                insights.append({
                    "username": username,
                    "topic": topic_name,
                    "correct_answers": correct_answers,
                    "total_questions": total_questions,
                    "score": score,
                    "date": _latest_answer_timestamp(answers),
                    "avatar_url": _user_avatar_url(user) if user else _avatar_url(username),
                })

        insights.sort(
            key=lambda row: str(row.get("date") or ""),
            reverse=True
        )

        return StandardResponse(
            success=True,
            message="Quiz insights retrieved",
            data=insights
        )

    except Exception as e:
        logger.error(f"Error fetching quiz insights: {e}", exc_info=True)
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message=f"Failed to fetch quiz insights: {str(e)}",
            data=[]
        )


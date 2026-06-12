from typing import Dict, Any, List

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
    update_current_zone_service,
)
from app.modules.learning_path.services.learn_path_service import DefaultLearningEvaluator

from app.utils.logger import get_logger
from app.core.database_mongo import get_mongo_db
from app.core.standard_response import StandardResponse

from datetime import datetime

from app.modules.learning_path.models.learn_path import Topics

router = APIRouter(prefix="/game", tags=["game"])
logger = get_logger(__name__)
evaluator = DefaultLearningEvaluator()

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

        logger.info(f"Remaining Unanswered questions: {unanswered_qmap}")
        logger.info(f"questionsTotal: {len(qmap)}")
        return StandardResponse(
            success=True,
            message="Successfully generated unanswered question list",
            data={
                "questions": unanswered_qmap,
                "questionsTotal": len(unanswered_qmap)
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
                # Get a quick estimate based on progress data
                # Instead of computing full scores, use available progress metrics
                progress_data = doc.get("progress", {})

                # Calculate simple average from available topic progress
                total_correct = 0
                total_questions = 0

                for topic_name, topic_data in progress_data.items():
                    if isinstance(topic_data, dict):
                        # Count answered questions
                        answers = topic_data.get("answers", [])
                        if isinstance(answers, list):
                            for answer_data in answers:
                                if isinstance(answer_data, dict):
                                    total_questions += 1
                                    if answer_data.get("is_correct", False):
                                        total_correct += 1

                # Use total correct answers as progressive score
                score = total_correct

                user_scores.append({
                    "user_id": user_id,
                    "overall_knowledge_score": score
                })
            except Exception as e:
                logger.error(f"Error computing score for user {user_id}: {e}")
                # Add user with 0 score rather than skipping
                user_scores.append({
                    "user_id": user_id,
                    "overall_knowledge_score": 0
                })
                continue

        # Sort by score descending and limit results
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
        # Get all progress documents
        progress_docs = await db["progress"].find({}).to_list(None)

        if not progress_docs:
            logger.info("No progress documents found")
            return StandardResponse(
                success=True,
                message="No student data available",
                data=[]
            )

        # Initialize topic scores
        topic_scores = {topic.value: [] for topic in Topics}

        for doc in progress_docs:
            try:
                progress_data = doc.get("progress", {})

                # Process each topic
                for topic in Topics:
                    topic_name = topic.value
                    topic_data = progress_data.get(topic_name, {})

                    # Count correct and total answers for this topic
                    total_correct = 0
                    total_questions = 0

                    answers = topic_data.get("answers", [])
                    if isinstance(answers, list):
                        for answer_data in answers:
                            if isinstance(answer_data, dict):
                                total_questions += 1
                                if answer_data.get("is_correct", False):
                                    total_correct += 1

                    # Calculate score for this topic if questions were answered
                    if total_questions > 0:
                        score_percentage = (total_correct / total_questions) * 100
                        topic_scores[topic_name].append(score_percentage)

            except Exception as e:
                logger.warning(f"Error processing user doc: {e}")
                continue

        # Calculate average score for each topic
        topic_performance = []
        for topic in Topics:
            topic_name = topic.value
            scores = topic_scores[topic_name]

            if scores:
                avg_score = sum(scores) / len(scores)
            else:
                avg_score = 0

            # Store short name for display
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


from typing import Dict, Any, List

from bson import ObjectId
from fastapi import APIRouter, Depends, status, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.game.schemas.gameschemas import (
    InitialAssessmentRequest,
    InitialAssessmentResponseItems,
    GetUser,
    GetUserTopic,
    SingleResponseItem
)
from app.modules.game.services.services import (
    evaluate_assessment,
    evaluate_subcat_grade,
    save_assessment_result,
    db_findby_id,
    generate_question_list,
    save_popup_question_result,
    save_assessment_question_result,
    ensure_initial_assessment_doc
)
from app.modules.learning_path.services.learn_path_service import DefaultLearningEvaluator

from app.utils.logger import get_logger
from app.core.database_mongo import get_mongo_db
from app.core.standard_response import StandardResponse
from datetime import datetime

router = APIRouter(prefix="/game", tags=["game"])
logger = get_logger(__name__)
evaluator = DefaultLearningEvaluator()

@router.post("/initassess/", response_model=StandardResponse[InitialAssessmentResponseItems], status_code=status.HTTP_201_CREATED)
async def initial_assessment_evaluation(
    request: InitialAssessmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = None

):
    logger.info("initial_assessment_evaluation: Evaluating initial assessment")

    grade_dict = evaluate_assessment(request.assessment_response, evaluator)
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

@router.post("/assessment/submit", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK)
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
                collection_name="progression"
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

@router.post("/question/submit/single", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK)
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

    await save_popup_question_result(db, request.userid, request.topic, request, "progress")

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

@router.post("/data", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK)
async def get_user_data_from_collection(
        request: GetUser,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/initassess/data. User ID: '{request.userid}', Collection: '{request.collectionName}'.")


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

    logger.info("requesting db")
    document = await db_findby_id(db, user_uuid, request.collectionName)

    if document:
        logger.info(f"Document found. User ID: '{user_uuid}', Collection: '{request.collectionName}'.")

        if "_id" in document and isinstance(document["_id"], ObjectId):
            document["_id"] = str(document["_id"])

        # Removed the try-except block for mapping to InitialAssessmentResponse
        # Now returning the document directly

        return StandardResponse(
            success=True,
            message="Data retrieved successfully.",
            data=document  # Return the raw document
        )
    else:
        logger.info(f"No document found. User ID: '{user_uuid}', Collection: '{request.collectionName}'.")
        response.status_code = status.HTTP_404_NOT_FOUND
        return StandardResponse(
            success=False,
            message=f"Data not found for user '{user_uuid}' in collection '{request.collectionName}'.",
            data=None
        )

@router.post("/generate/qlist/", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_201_CREATED)
async def generate_user_question_list(
        request: GetUserTopic,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/initassess/questions/. user_id: '{request.userid}', Collection: '{request.collectionName}'.")

    user_uuid = ""

    try:
        # Convert user_id string from path to UUID, as find_document_by_user_id expects UUID
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

        logger.info(f"Successfully created question map: {qmap}, proceeding to updating document")

        result = await save_assessment_question_result(db, user_uuid, qmap, request.topic, request.collectionName)
        return StandardResponse(
            success=True,
            message="Successfully generated question list",
            data={"questions": result}
        )

    except Exception as e:
        logger.error(f"Error in generating user question list: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to generate question list",
            data=None
        )
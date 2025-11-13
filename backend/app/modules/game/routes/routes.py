from typing import Dict, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, status, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.game.schemas.gameschemas import InitialAssessmentRequest, InitialAssessmentResponse, GetUser, \
    GetUserTopic
from app.modules.game.services.services import (
    evaluate_assessment,
    evaluate_subcat_grade,
    save_assessment_result, db_findby_id, generate_question_list, save_question_result,
)
from app.modules.learning_path.services.learn_path_service import DefaultLearningEvaluator
from app.utils.logger import get_logger
from app.core.database_mongo import get_mongo_db
from app.core.standard_response import StandardResponse
from datetime import datetime
from pprint import pformat

router = APIRouter(prefix="/game", tags=["game"])
logger = get_logger(__name__)
evaluator = DefaultLearningEvaluator()

@router.post("/initassess/", response_model=StandardResponse[InitialAssessmentResponse], status_code=status.HTTP_201_CREATED)
async def initial_assessment_evaluation(
    request: InitialAssessmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = None  # inject response object

):
    logger.info("Evaluating initial assessment")

    grade_dict = evaluate_assessment(request.assessment_response, evaluator)
    logger.info(f"DEBUG: {grade_dict}")
    subcat_grade = evaluate_subcat_grade(grade_dict)
    subcat_priority = evaluator.evaluate_subcat_priority(request.topic, subcat_grade)
    try:
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
        data=InitialAssessmentResponse(
            inserted_id=str(inserted_id),
            timestamp=datetime.utcnow(),
            userid=request.userid,
        )
    )

@router.post("/data", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK
            )
async def get_user_data_from_collection(
        request: GetUser,
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/initassess/data. User ID: '{request.userid}', Collection: '{request.collectionName}'.")


    try:
        # Convert user_id string from path to UUID, as find_document_by_user_id expects UUID
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

        result = await save_question_result(db, user_uuid, qmap, request.topic, request.collectionName)
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
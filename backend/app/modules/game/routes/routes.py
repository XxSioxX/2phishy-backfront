from typing import Dict, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, status, Response, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.game.schemas.gameschemas import (
    InitialAssessmentRequest, InitialAssessmentResponse, GetUser, GetUserTopic, TopicRequest,
    AssessmentSessionCreate, AssessmentSessionResponse, AssessmentResultCreate, AssessmentSessionEnd
)
from app.core.auth import verify_token
from fastapi.security import HTTPBearer
security_scheme = HTTPBearer()
from app.modules.game.services.services import (
    evaluate_assessment,
    evaluate_subcat_grade,
    save_assessment_result, db_findby_id, generate_question_list, save_question_result, load_and_prepare_knowledge_base,
    save_assessment_session, save_assessment_result_item, end_assessment_session
)
from app.modules.learning_path.services.learn_path_service import DefaultLearningEvaluator
from app.utils.logger import get_logger
from app.core.database_mongo import get_mongo_db
from app.core.standard_response import StandardResponse
from datetime import datetime
from pprint import pformat
from uuid import UUID

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

@router.get("/data", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK
            )
async def get_user_data_from_collection(
        userid: str = Query(..., description="User ID"),
        collectionName: str = Query(..., description="Collection name"),
        db: AsyncIOMotorDatabase = Depends(get_mongo_db),
        response: Response = Response(),
):
    logger.info(f"Request for /game/data. User ID: '{userid}', Collection: '{collectionName}'.")


    try:
        # Convert user_id string from path to UUID, as find_document_by_user_id expects UUID
        user_uuid = UUID(userid)
    except ValueError:
        logger.error(f"Invalid user_id format: {userid}. Must be a valid UUID.")
        response.status_code = status.HTTP_400_BAD_REQUEST
        return StandardResponse(
            success=False,
            message="Invalid user_id format. Must be a valid UUID.",
            data=None
        )


    logger.info("requesting db")
    document = await db_findby_id(db, user_uuid, collectionName)

    if document:
        logger.info(f"Document found. User ID: '{user_uuid}', Collection: '{collectionName}'.")

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
        logger.info(f"No document found. User ID: '{user_uuid}', Collection: '{collectionName}'.")
        response.status_code = status.HTTP_404_NOT_FOUND
        return StandardResponse(
            success=False,
            message=f"Data not found for user '{user_uuid}' in collection '{collectionName}'.",
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


@router.post("/questions", response_model=StandardResponse[Dict[str, Any]], status_code=status.HTTP_200_OK)
async def get_initial_assessment_questions(
        request: TopicRequest,
        response: Response = Response()
):
    """
    Fetch initial assessment questions from knowledge base for a given topic.
    Returns questions organized by subtopic key for faster frontend access.
    """
    logger.info(f"Fetching questions for topic: {request.topic.value}")
    
    try:
        kb_questions = load_and_prepare_knowledge_base(request.topic.value)
        
        if not kb_questions:
            response.status_code = status.HTTP_404_NOT_FOUND
            return StandardResponse(
                success=False,
                message=f"No questions found for topic '{request.topic.value}'",
                data=None
            )
        
        return StandardResponse(
            success=True,
            message="Questions retrieved successfully",
            data={"topic": request.topic.value, "questions": kb_questions}
        )
    except Exception as e:
        logger.error(f"Error fetching questions for topic '{request.topic.value}': {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return StandardResponse(
            success=False,
            message="Failed to retrieve questions",
            data=None
        )


# Assessment session endpoints for the game
@router.post("/assessment/start", response_model=AssessmentSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_assessment_session(
    session_data: AssessmentSessionCreate,
    credentials: dict = Depends(security_scheme),
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response()
):
    """Start a new assessment session (for in-game assessments)"""
    
    # Get user ID from JWT token
    if not credentials:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"error": "Authentication required"}
    
    token = credentials.credentials
    user_id = verify_token(token)
    
    if not user_id:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"error": "Invalid or expired token"}
    
    logger.info(f"Starting assessment session for user {user_id}")
    
    try:
        start_time = datetime.fromisoformat(session_data.start_time.replace('Z', '+00:00'))
        session_result = await save_assessment_session(
            db, user_id, session_data.topic, start_time
        )
        
        return session_result
        
    except Exception as e:
        logger.error(f"Error starting assessment session: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        raise


@router.post("/assessment/result", status_code=status.HTTP_201_CREATED)
async def submit_assessment_result(
    result_data: AssessmentResultCreate,
    session_id: str = Query(...),
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response()
):
    """Submit an individual assessment result"""
    logger.info(f"Submitting assessment result for session {session_id}")
    
    try:
        # Get user_id from the session
        sessions_collection = db["assessment_sessions"]
        session = await sessions_collection.find_one({"session_id": session_id})
        
        if not session:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"error": "Assessment session not found"}
        
        userid = session["user_id"]
        logger.info(f"Found session for user {userid}")
        
        result_dict = {
            "question_id": result_data.question_id,
            "user_answer": result_data.user_answer,
            "correct_answer": result_data.correct_answer,
            "is_correct": result_data.is_correct,
            "topic": result_data.topic,
            "subcategory": result_data.subcategory,
            "timestamp": result_data.timestamp
        }
        
        await save_assessment_result_item(db, session_id, userid, result_dict)
        
        return {"message": "Assessment result submitted successfully"}
        
    except Exception as e:
        logger.error(f"Error submitting assessment result: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"error": str(e)}


@router.post("/assessment/end", response_model=AssessmentSessionResponse, status_code=status.HTTP_200_OK)
async def end_assessment_session_endpoint(
    session_id: str,
    end_data: AssessmentSessionEnd,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    response: Response = Response()
):
    """End an assessment session"""
    logger.info(f"Ending assessment session {session_id}")
    
    try:
        # Get user_id from the session
        sessions_collection = db["assessment_sessions"]
        session = await sessions_collection.find_one({"session_id": session_id})
        
        if not session:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"error": "Assessment session not found"}
        
        userid = session["user_id"]
        logger.info(f"Found session for user {userid}")
        
        session_result = await end_assessment_session(
            db, session_id, userid, end_data.end_time,
            end_data.total_score, end_data.total_questions
        )
        
        return session_result
        
    except Exception as e:
        logger.error(f"Error ending assessment session: {e}")
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {"error": str(e)}





"""
Quick script to show assessment data from MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import json

load_dotenv()

DATABASE_MONGO_URL = os.getenv("DATABASE_MONGO_URL", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "phishy_game")

async def show_assessment_data():
    print("=" * 60)
    print("Assessment Data in MongoDB")
    print("=" * 60)
    
    try:
        client = AsyncIOMotorClient(DATABASE_MONGO_URL)
        db = client[MONGO_DB_NAME]
        
        # Check assessment_sessions
        print("\n=== ASSESSMENT SESSIONS ===")
        sessions_collection = db["assessment_sessions"]
        sessions_count = await sessions_collection.count_documents({})
        print(f"Total sessions: {sessions_count}\n")
        
        if sessions_count > 0:
            async for doc in sessions_collection.find({}).sort("created_at", -1):
                print(f"Session ID: {doc.get('session_id')}")
                print(f"User ID: {doc.get('user_id')}")
                print(f"Topic: {doc.get('topic')}")
                print(f"Score: {doc.get('total_score')}/{doc.get('total_questions')}")
                print(f"Completed: {doc.get('completed')}")
                print(f"Start: {doc.get('start_time')}")
                print(f"End: {doc.get('end_time')}")
                print("-" * 60)
        
        # Check assessment_results
        print("\n=== ASSESSMENT RESULTS ===")
        results_collection = db["assessment_results"]
        results_count = await results_collection.count_documents({})
        print(f"Total results: {results_count}\n")
        
        if results_count > 0:
            async for doc in results_collection.find({}):
                print(f"Question: {doc.get('question_id')}")
                print(f"User Answer: {doc.get('user_answer')}")
                print(f"Correct Answer: {doc.get('correct_answer')}")
                print(f"Correct: {doc.get('is_correct')}")
                print(f"User ID: {doc.get('user_id')}")
                print(f"Session ID: {doc.get('session_id')}")
                print("-" * 60)
        
        client.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(show_assessment_data())


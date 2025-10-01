@echo off
REM Batch script to start the FastAPI server using uvicorn
echo Starting Phishy Game Backend API...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

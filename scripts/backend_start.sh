#!/bin/bash
cd backend
source virtual_env/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

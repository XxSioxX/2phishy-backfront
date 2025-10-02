# PROJECT LATEST

PROJECT LATEST

## Features

- **User Management**: Registration, login, profile management
- **Learning Path System**: Topic-based learning with priority scoring
- **Game Progress Tracking**: Save and load game states
- **Score Persistence**: Track high scores and achievements
- **Advanced Logging**: Colored, structured logging system
- **Database Support**: PostgreSQL and SQLite support

## Quick Start

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up Environment**:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   # Edit .env with your database configuration
   ```

3. **Start the Server**:
   ```bash
   # Windows
   start_server.bat
   
   # Or manually
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Access API Documentation**:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## API Endpoints

### User Management
- `POST /users/register` - Register new user
- `POST /users/login` - User login
- `GET /users/` - Get all users
- `GET /users/{user_id}` - Get user by ID
- `PUT /users/{user_id}` - Update user
- `DELETE /users/{user_id}` - Delete user

### Learning Path
- `GET /learning-path/{user_id}` - Get user's learning paths
- `POST /learning-path/` - Create learning path entry
- `PUT /learning-path/{path_id}` - Update learning path

### Game Progress
- `GET /game/progress/{user_id}` - Get user's game progress
- `POST /game/progress/` - Save game progress
- `GET /game/scores/{user_id}` - Get user's scores
- `POST /game/scores/` - Save game score

## Database Models

### User
- UUID-based user IDs
- Username, email, password
- Account status and roles
- Created timestamp and last login

### Learning Path
- Topic categorization (Safe Browsing, Password Security, etc.)
- Priority scoring (HIGH, MODERATE, LOW)
- Progress tracking

### Game Progress
- Level progression
- Score tracking
- Game state persistence
- Time tracking

## Development

The backend is structured with:
- `app/core/` - Database configuration and core utilities
- `app/modules/` - Feature modules (user, learning_path, game)
- `app/utils/` - Utility functions (logging, etc.)

Each module contains:
- `models/` - SQLAlchemy database models
- `schemas/` - Pydantic request/response schemas
- `routes/` - FastAPI route handlers
- `services/` - Business logic

## Environment Variables

- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - JWT secret key
- `CORS_ORIGINS` - Allowed CORS origins

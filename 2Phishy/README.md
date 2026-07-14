# 2Phishy

2Phishy is a cybersecurity learning platform with three main parts:

- a React dashboard for students, admins, and super-admins;
- a Phaser-based game experience for the cybersecurity lessons;
- a FastAPI backend that stores user data, game progress, reports, content, and analytics.

## Project structure

- `image-display-app/` — frontend dashboard and embedded game entry points
- `backend/` — FastAPI application, data models, and services
- `docs/` — implementation notes and API/testing notes
- `docker-compose.dev.yml` — local development stack
- `docker-compose.prod.yml` — production stack

## Frontend

The frontend is a React application that provides:

- login and registration;
- student profile pages;
- posts and announcements;
- reports and quiz insights;
- admin dashboards and charts;
- the game page and game status flows.

Development:

```bash
cd image-display-app
npm install
npm start
```

Type check:

```bash
cd image-display-app
npm run type-check
```

Build:

```bash
cd image-display-app
npm run build
```

## Backend

The backend is a FastAPI application.

Development:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## API endpoints

All routes are mounted under `/api` unless noted otherwise.

### Auth

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Users

- `POST /api/users/register`
- `POST /api/users/login`
- `GET /api/users/`
- `GET /api/users/{user_id}`
- `PUT /api/users/{user_id}`
- `DELETE /api/users/{user_id}`
- `GET /api/users/me/`
- `PUT /api/users/me/`
- `POST /api/users/presence`

### Admin

- `GET /api/admin/stats`
- `PATCH /api/admin/users/{user_id}/role/{new_role}`
- `PATCH /api/admin/users/{user_id}/status/{new_status}`
- `DELETE /api/admin/users/{user_id}`
- `GET /api/admin/my-role`
- `GET /api/admin/data-export`
- `POST /api/admin/users/create-admin`
- `GET /api/admin/super-admin/stats`

### Posts

- `POST /api/posts/`
- `GET /api/posts/`
- `GET /api/posts/{post_id}`
- `PUT /api/posts/{post_id}`
- `DELETE /api/posts/{post_id}`

### Announcements

- `GET /api/announcements`
- `POST /api/announcements`
- `PUT /api/announcements/{announcement_id}`
- `DELETE /api/announcements/{announcement_id}`

### Reports

- `GET /api/reports`
- `POST /api/reports`
- `PUT /api/reports/{report_id}`
- `DELETE /api/reports/{report_id}`

### System

- `GET /api/system/settings`
- `PUT /api/system/settings`
- `GET /api/system/content/{content_type}`
- `PUT /api/system/content/{content_type}/draft`
- `POST /api/system/content/{content_type}/publish`

### Presence

- `POST /api/presence/heartbeat`
- `GET /api/presence/online-status`

### Game

- `POST /api/game/initassess/`
- `POST /api/game/assessment/submit`
- `POST /api/game/question/submit/single`
- `POST /api/game/progress/complete`
- `POST /api/game/progress/intro-seen`
- `POST /api/game/progress/zone`
- `POST /api/game/progress/gameplay`
- `POST /api/game/data`
- `POST /api/game/generate/knowledgelist/`
- `POST /api/game/generate/qlist/`
- `POST /api/game/questionlist/update/`
- `POST /api/game/submit/se-submit/`
- `POST /api/game/score/topic/`
- `POST /api/game/score/overall/`
- `POST /api/game/score/full-profile/`
- `GET /api/game/score/users/top-scores/`
- `GET /api/game/score/topics/performance/`
- `GET /api/game/score/users/performance-categories/`
- `GET /api/game/admin/level-skill-performance`
- `GET /api/game/admin/quiz-insights`

### Root and health

- `GET /api`
- `GET /api/health`

## Databases and cache

### PostgreSQL

Used for:

- users;
- authentication-related relational data;
- posts;
- password reset tokens.

Connection and setup live in:

- `backend/app/core/database_postgres.py`

### MongoDB

Used for:

- game progress;
- initial assessments;
- reports;
- announcements;
- system content/settings documents.

Connection setup lives in:

- `backend/app/core/database_mongo.py`

### Redis

Used for:

- online presence keys;
- password reset throttling;
- cached published content;
- cache warm-up at startup.

Redis connection setup lives in:

- `backend/app/core/cache_redis.py`

## Main data models

### PostgreSQL models

- `User`
- `Post`
- `PasswordResetToken`

### MongoDB collections

- `progress`
- `initial_assessments`
- `reports`
- `announcements`
- `system_settings`
- `system_content`

## Development notes

Backend module layout:

- `app/core/` — database connections, Redis, startup, security, shared helpers
- `app/modules/` — feature modules
- `app/utils/` — logging and utility helpers

Feature modules include:

- `auth`
- `user`
- `posts`
- `announcements`
- `reports`
- `system`
- `game`
- `presence`
- `learning_path`

## Docker

Run the full local stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Stop the stack:

```bash
docker compose -f docker-compose.dev.yml down
```

## Environment variables

Common backend variables:

- `DATABASE_POSTGRES_URL`
- `MONGO_USER`
- `MONGO_PASSWORD`
- `MONGO_HOST`
- `MONGO_PORT`
- `MONGO_DB_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `SECRET_KEY`
- `FRONTEND_URL`
- `SUPER_ADMIN_USERNAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Notes

- The backend serves the API; the frontend consumes it.
- Redis is used as a cache and short-lived state store, not as the primary system of record.
- If you add new endpoints or collections, update this README and the backend API notes together.


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database_mongo import verify_mongo_connection
from app.modules.user.routes.routes import router as user_router
from app.modules.user.routes.admin_routes import router as admin_router
from app.modules.game.routes.routes import router as game_router
from app.modules.posts.routes.post_routes import router as post_router
from app.modules.auth.routes.routes import router as auth_router
from app.modules.announcements.routes import router as announcements_router
from app.modules.reports.routes import router as reports_router
from app.modules.system.routes import router as system_router
from app.utils.logger import get_logger
from app.core.database_postgres import init_db
from app.core.startup import startup_super_admin

from app.core.cache_loader import preload_static_assets
from app.core.cache_redis import redis_client
from app.modules.presence.routes.routes import router as presence_router

logger = get_logger("main")

API_DESCRIPTION = """
Phishy backend API for authentication, user administration, game progress,
dashboard analytics, bulletin posts, announcements, reports, and online
presence.

Interactive browser documentation is available at `/docs` and `/redoc` when
the backend is running.
"""

OPENAPI_TAGS = [
    {
        "name": "game",
        "description": "Gameplay, progress, scoring, and admin dashboard analytics.",
    },
    {
        "name": "dashboard analytics",
        "description": "Admin-facing aggregate metrics used by the main dashboard.",
    },
    {
        "name": "Presence",
        "description": "Heartbeat and online-user status endpoints.",
    },
    {
        "name": "users",
        "description": "Registration, login, profiles, and user management.",
    },
    {
        "name": "admin",
        "description": "Administrative user actions.",
    },
    {
        "name": "posts",
        "description": "Bulletin board post management.",
    },
    {
        "name": "auth",
        "description": "Password reset and authentication support endpoints.",
    },
]

@asynccontextmanager
async def lifespan(app:FastAPI):
    logger.info("Starting lifespan Updated Lifespan")
    try:
        verify_mongo_connection()
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}")

    try:
        init_db()
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed: {e}")

    try:
        startup_super_admin()
    except Exception as e:
        logger.error(f"Startup super admin failed: {e}")

    try:
        await redis_client.ping()
        logger.info("Redis connection successful")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

    try:
        await preload_static_assets()
    except Exception as e:
        logger.error(f"assets caching failed:  {e}")

    logger.info("Finished establishing database connections")
    yield

app = FastAPI(
    title="Phishy Game Backend API",
    version="6.3.0",
    description=API_DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


origins = [
    "http://localhost:3000",  # React default port
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
    "http://localhost:9000",  # Phaser game port
    "http://127.0.0.1:9000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include routers
app.include_router(user_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(game_router, prefix="/api")
app.include_router(post_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(announcements_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(presence_router, prefix="/api")
app.include_router(system_router, prefix="/api")

@app.get("/api")
async def root():
    return {
        "message": "Phishy Game Backend API is running",
        "version": "6.3.0",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json",
        },
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Backend is running properly"}

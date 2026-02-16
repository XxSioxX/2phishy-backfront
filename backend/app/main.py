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
from app.utils.logger import get_logger
from app.core.database_postgres import init_db
from app.core.startup import startup_super_admin

logger = get_logger("main")

@asynccontextmanager
async def lifespan(app:FastAPI):
    logger.info("Starting lifespan")
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

    logger.info("Finished establishing database connections")
    yield

app = FastAPI(title="Phishy Game Backend API", version="6.3.0", lifespan=lifespan)


origins = [
    "http://localhost:3000",  # React default port
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
    "http://localhost:9000",  # Your Phaser game port
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


@app.get("/api")
async def root():
    return {"message": "Phishy Game Backend API is running", "version": "6.3.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Backend is running properly"}

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.core.database_mongo import verify_mongo_connection
from app.modules.user.routes.routes import router as user_router
from app.modules.game.routes.routes import router as game_router
from app.utils.logger import get_logger
from app.core.database_postgres import init_db
import os


logger = get_logger("main")

@asynccontextmanager
async def lifespan(app:FastAPI):
    logger.info("Starting lifespan")
    verify_mongo_connection()
    init_db()

    logger.info("Finished establishing database connections")
    yield

app = FastAPI(lifespan=lifespan)


origins_env = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

# Apply CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(game_router)

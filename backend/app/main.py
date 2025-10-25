from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.database_mongo import verify_mongo_connection
from app.modules.user.routes.routes import router as user_router
from app.modules.game.routes.routes import router as game_router
from app.utils.logger import get_logger
from app.core.database_postgres import init_db

logger = get_logger("main")

@asynccontextmanager
async def lifespan(app:FastAPI):
    logger.info("Starting lifespan")
    verify_mongo_connection()
    init_db()

    logger.info("Finished establishing database connections")
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(user_router)
app.include_router(game_router)

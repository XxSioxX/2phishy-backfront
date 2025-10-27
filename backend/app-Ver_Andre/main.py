from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.user.routes.routes import router as user_router
from app.modules.user.routes.admin_routes import router as admin_router
from app.modules.learning_path.routes.routes import router as learning_path_router
from app.modules.game.routes.routes import router as game_router
from app.utils.logger import get_logger
from app.core.database import init_db

logger = get_logger("main")
app = FastAPI(title="Phishy Game Backend API", version="1.0.0")

# Add CORS middleware with explicit configuration
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.on_event("startup")
def startup():
    logger.info("Starting up the application...")
    logger.info(f"CORS enabled for origins: {origins}")
    init_db()  # Ensure tables exist on startup

# Include routers
app.include_router(user_router)
app.include_router(admin_router)  # Admin routes with /admin prefix
app.include_router(learning_path_router)
app.include_router(game_router)

@app.get("/")
async def root():
    return {"message": "Phishy Game Backend API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Backend is running properly"}

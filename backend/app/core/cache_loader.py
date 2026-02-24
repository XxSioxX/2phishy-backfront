import json
from pathlib import Path


from app.utils.logger import get_logger


async def preload_static_assets(redis):

    logger = get_logger()

    logger.info("Loading static assets")
    try:

        BASE_DIR = Path(__file__).resolve().parents[1]
        assets_dir = BASE_DIR / "backend-assets"


        with open(assets_dir / "question_base.json") as f:
            qb = json.load(f)
            await redis.set("static:question_base", json.dumps(qb))

        with open(assets_dir / "knowledge_base.json") as f:
            kb = json.load(f)
            await redis.set("static:knowledge_base", json.dumps(kb))

    except Exception as e:
        logger.warning(f"static asset preloading failed: {e}")


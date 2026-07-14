from app.modules.system.services.services import get_published_content_or_default
from app.utils.logger import get_logger


async def preload_static_assets():

    logger = get_logger()

    logger.info("Loading static assets")
    content_types = ("question_base", "knowledge_base", "initial_assessment")

    for content_type in content_types:
        try:
            await get_published_content_or_default(content_type)
            logger.info(f"Cached static asset: {content_type}")
        except Exception as e:
            logger.warning(f"static asset preloading failed for {content_type}: {e}")


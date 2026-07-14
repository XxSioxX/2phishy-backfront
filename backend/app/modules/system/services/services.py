import copy
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.cache_redis import get_or_load_json_cached, set_json_cached
from app.core.database_mongo import db as mongo_db
from app.utils.logger import get_logger

logger = get_logger("system-services.py")

BASE_DIR = Path(__file__).resolve().parents[3]
ASSETS_DIR = BASE_DIR / "backend-assets"
SETTINGS_DOC_ID = "default"
SETTINGS_COLLECTION = "system_settings"
CONTENT_COLLECTION = "system_content"
CONTENT_CACHE_TTL_SECONDS = 3600

DEFAULT_SYSTEM_SETTINGS: Dict[str, str] = {
    "system_name": "2Phishy",
    "institution_name": "2Phishy",
    "logo_url": "/logo1.png",
    "login_subtitle": "Please enter your credentials to log in",
    "register_subtitle": "Please fill in your details to register",
    "privacy_summary": (
        "2Phishy collects account details, gameplay progress, quiz answers, "
        "assessment results, reports, and related learning analytics for academic "
        "research and system evaluation."
    ),
    "consent_text": (
        "I accept the Privacy Policy and agree to participate in this thesis study. "
        "I understand that my data will be used for academic purposes."
    ),
}

CONTENT_CONFIG = {
    "knowledge_base": {
        "label": "Knowledgebase",
        "filename": "knowledge_base.json",
        "redis_key": "static:knowledge_base",
    },
    "question_base": {
        "label": "Questionbase",
        "filename": "question_base.json",
        "redis_key": "static:question_base",
    },
    "initial_assessment": {
        "label": "Initial Assessments",
        "filename": "initial_assessment.json",
        "redis_key": "static:initial_assessment:initial_assessment.json",
    },
}


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def clean_mongo_doc(doc: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not doc:
        return {}

    cleaned = dict(doc)
    cleaned.pop("_id", None)
    return cleaned


def default_settings() -> Dict[str, Any]:
    return copy.deepcopy(DEFAULT_SYSTEM_SETTINGS)


async def get_system_settings() -> Dict[str, Any]:
    doc = await mongo_db[SETTINGS_COLLECTION].find_one({"_id": SETTINGS_DOC_ID})
    settings = default_settings()
    settings.update(clean_mongo_doc(doc))
    return settings


async def update_system_settings(payload: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    allowed = set(DEFAULT_SYSTEM_SETTINGS.keys())
    updates = {
        key: value
        for key, value in payload.items()
        if key in allowed and value is not None
    }

    updates["updated_at"] = utc_now_iso()
    updates["updated_by"] = user_id

    await mongo_db[SETTINGS_COLLECTION].update_one(
        {"_id": SETTINGS_DOC_ID},
        {"$set": updates},
        upsert=True,
    )
    return await get_system_settings()


def validate_content_type(content_type: str) -> Dict[str, str]:
    if content_type not in CONTENT_CONFIG:
        raise ValueError(f"Unsupported content type: {content_type}")
    return CONTENT_CONFIG[content_type]


def load_default_content(content_type: str) -> Any:
    config = validate_content_type(content_type)
    with open(ASSETS_DIR / config["filename"], "r", encoding="utf-8") as file:
        return json.load(file)


async def get_published_content_or_default(content_type: str) -> Any:
    config = validate_content_type(content_type)

    async def load_content() -> Any:
        doc = await mongo_db[CONTENT_COLLECTION].find_one({"_id": content_type})
        published = (doc or {}).get("published") or {}
        data = published.get("data")
        if data is not None:
            return data
        return load_default_content(content_type)

    return await get_or_load_json_cached(
        config["redis_key"],
        load_content,
        ttl_seconds=CONTENT_CACHE_TTL_SECONDS,
    )


async def get_content_record(content_type: str) -> Dict[str, Any]:
    config = validate_content_type(content_type)
    doc = await mongo_db[CONTENT_COLLECTION].find_one({"_id": content_type}) or {}
    draft = doc.get("draft") or {}
    published = doc.get("published") or {}
    data = draft.get("data")
    source = "draft"

    if data is None:
        data = published.get("data")
        source = "published"

    if data is None:
        data = await get_published_content_or_default(content_type)
        source = "published" if published.get("data") is not None else "default"

    return {
        "content_type": content_type,
        "label": config["label"],
        "data": data,
        "source": source,
        "draft_version": int(draft.get("version") or 0),
        "published_version": int(published.get("version") or 0),
        "has_draft": draft.get("data") is not None,
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by"),
    }


async def save_content_draft(content_type: str, data: Any, user_id: str) -> Dict[str, Any]:
    validate_content_type(content_type)
    doc = await mongo_db[CONTENT_COLLECTION].find_one({"_id": content_type}) or {}
    current_draft = (doc.get("draft") or {}).get("version") or 0
    published_version = (doc.get("published") or {}).get("version") or 0
    next_version = max(int(current_draft), int(published_version)) + 1

    now = utc_now_iso()
    await mongo_db[CONTENT_COLLECTION].update_one(
        {"_id": content_type},
        {
            "$set": {
                "draft": {
                    "data": data,
                    "version": next_version,
                    "updated_at": now,
                    "updated_by": user_id,
                },
                "updated_at": now,
                "updated_by": user_id,
            }
        },
        upsert=True,
    )
    return await get_content_record(content_type)


async def publish_content(content_type: str, user_id: str, data: Any = None) -> Dict[str, Any]:
    config = validate_content_type(content_type)
    doc = await mongo_db[CONTENT_COLLECTION].find_one({"_id": content_type}) or {}
    draft = doc.get("draft") or {}
    published = doc.get("published") or {}
    content_data = data if data is not None else draft.get("data")

    if content_data is None:
        content_data = published.get("data")

    if content_data is None:
        content_data = load_default_content(content_type)

    next_version = max(int(draft.get("version") or 0), int(published.get("version") or 0)) + 1
    now = utc_now_iso()
    await mongo_db[CONTENT_COLLECTION].update_one(
        {"_id": content_type},
        {
            "$set": {
                "published": {
                    "data": content_data,
                    "version": next_version,
                    "published_at": now,
                    "published_by": user_id,
                },
                "updated_at": now,
                "updated_by": user_id,
            },
            "$unset": {"draft": ""},
        },
        upsert=True,
    )

    try:
        await set_json_cached(
            config["redis_key"],
            content_data,
            ttl_seconds=CONTENT_CACHE_TTL_SECONDS,
        )
    except Exception as exc:
        logger.warning(f"Unable to refresh Redis content cache for {content_type}: {exc}")

    return await get_content_record(content_type)

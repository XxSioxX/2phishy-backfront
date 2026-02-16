from app.core.database_mongo import db
from datetime import datetime
from bson import ObjectId
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AnnouncementService:
    def __init__(self):
        self.collection = db.announcements

    async def create_announcement(self, announcement_data: dict) -> dict:
        """Create a new announcement"""
        try:
            announcement_data['createdAt'] = datetime.utcnow()
            announcement_data['updatedAt'] = datetime.utcnow()
            result = await self.collection.insert_one(announcement_data)
            announcement_data['_id'] = str(result.inserted_id)
            return announcement_data
        except Exception as e:
            logger.error(f"Error creating announcement: {e}")
            raise

    async def get_all_announcements(self) -> list:
        """Get all announcements"""
        try:
            announcements = []
            async for announcement in self.collection.find().sort("createdAt", -1):
                announcement['_id'] = str(announcement['_id'])
                announcements.append(announcement)
            return announcements
        except Exception as e:
            logger.error(f"Error getting announcements: {e}")
            raise

    async def get_announcement_by_id(self, announcement_id: str) -> dict:
        """Get announcement by ID"""
        try:
            announcement = await self.collection.find_one({"_id": ObjectId(announcement_id)})
            if announcement:
                announcement['_id'] = str(announcement['_id'])
            return announcement
        except Exception as e:
            logger.error(f"Error getting announcement: {e}")
            raise

    async def update_announcement(self, announcement_id: str, announcement_data: dict) -> dict:
        """Update an announcement"""
        try:
            announcement_data['updatedAt'] = datetime.utcnow()
            result = await self.collection.find_one_and_update(
                {"_id": ObjectId(announcement_id)},
                {"$set": announcement_data},
                return_document=True
            )
            if result:
                result['_id'] = str(result['_id'])
            return result
        except Exception as e:
            logger.error(f"Error updating announcement: {e}")
            raise

    async def delete_announcement(self, announcement_id: str) -> bool:
        """Delete an announcement"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(announcement_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting announcement: {e}")
            raise

    async def get_published_announcements(self) -> list:
        """Get only published announcements"""
        try:
            announcements = []
            async for announcement in self.collection.find({"isPublished": True}).sort("createdAt", -1):
                announcement['_id'] = str(announcement['_id'])
                announcements.append(announcement)
            return announcements
        except Exception as e:
            logger.error(f"Error getting published announcements: {e}")
            raise

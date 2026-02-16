from app.core.database_mongo import db
from datetime import datetime
from bson import ObjectId
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ReportService:
    def __init__(self):
        self.collection = db.reports

    async def create_report(self, report_data: dict) -> dict:
        """Create a new report"""
        try:
            report_data['createdAt'] = datetime.utcnow()
            report_data['updatedAt'] = datetime.utcnow()
            report_data['resolved'] = False
            result = await self.collection.insert_one(report_data)
            report_data['_id'] = str(result.inserted_id)
            return report_data
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            raise

    async def get_all_reports(self) -> list:
        """Get all reports (admin view)"""
        try:
            reports = []
            async for report in self.collection.find().sort("createdAt", -1):
                report['_id'] = str(report['_id'])
                reports.append(report)
            return reports
        except Exception as e:
            logger.error(f"Error getting reports: {e}")
            raise

    async def get_student_reports(self, student_id: str) -> list:
        """Get reports for a specific student"""
        try:
            reports = []
            async for report in self.collection.find({"studentId": student_id}).sort("createdAt", -1):
                report['_id'] = str(report['_id'])
                reports.append(report)
            return reports
        except Exception as e:
            logger.error(f"Error getting student reports: {e}")
            raise

    async def get_report_by_id(self, report_id: str) -> dict:
        """Get report by ID"""
        try:
            report = await self.collection.find_one({"_id": ObjectId(report_id)})
            if report:
                report['_id'] = str(report['_id'])
            return report
        except Exception as e:
            logger.error(f"Error getting report: {e}")
            raise

    async def update_report(self, report_id: str, report_data: dict) -> dict:
        """Update a report"""
        try:
            # If report is being resolved, set resolvedAt timestamp
            if report_data.get('resolved') and not report_data.get('resolvedAt'):
                report_data['resolvedAt'] = datetime.utcnow()
            
            report_data['updatedAt'] = datetime.utcnow()
            result = await self.collection.find_one_and_update(
                {"_id": ObjectId(report_id)},
                {"$set": report_data},
                return_document=True
            )
            if result:
                result['_id'] = str(result['_id'])
            return result
        except Exception as e:
            logger.error(f"Error updating report: {e}")
            raise

    async def delete_report(self, report_id: str) -> bool:
        """Delete a report"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(report_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting report: {e}")
            raise

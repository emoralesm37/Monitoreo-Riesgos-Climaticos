from pymongo.database import Database
from bson import ObjectId

from app.database import get_database
from app.models import ReportMetadata


def save_report_metadata(report: ReportMetadata) -> str:
    database: Database = get_database()

    document = report.model_dump(mode="python")

    result = database["reports"].insert_one(document)

    return str(result.inserted_id)


def get_report_metadata(report_id: str) -> dict | None:
    database: Database = get_database()

    if not ObjectId.is_valid(report_id):
        return None

    document = database["reports"].find_one(
        {"_id": ObjectId(report_id)}
    )

    if document is None:
        return None

    document["_id"] = str(document["_id"])

    return document

def update_report_metadata(
    report_id: str,
    updates: dict
) -> bool:
    database: Database = get_database()

    if not ObjectId.is_valid(report_id):
        return False

    allowed_fields = {
        "status",
        "file_name",
        "file_path",
        "downloaded_at"
    }

    safe_updates = {
        key: value
        for key, value in updates.items()
        if key in allowed_fields
    }

    if not safe_updates:
        return False

    result = database["reports"].update_one(
        {"_id": ObjectId(report_id)},
        {"$set": safe_updates}
    )

    return result.matched_count == 1

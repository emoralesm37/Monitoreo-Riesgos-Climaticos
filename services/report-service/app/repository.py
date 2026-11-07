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
        , "row_count"
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

def list_report_metadata(limit: int = 50, skip: int = 0, report_type: str | None = None) -> list[dict]:
    """
    Obtiene el historial de reportes,
    ordenado del más reciente al más antiguo.
    """

    database: Database = get_database()

    if not 1 <= limit <= 100:
        raise ValueError(
            "El límite debe estar entre 1 y 100"
        )

    cursor = (
        database["reports"]
        .find({"report_type": report_type} if report_type else {}, {"file_path": 0})
        .sort([("created_at", -1), ("_id", -1)])
        .skip(skip)
        .limit(limit)
    )

    reports = []

    for document in cursor:
        document["_id"] = str(document["_id"])
        reports.append(document)

    return reports


def count_reports(report_type: str | None = None) -> int:
    return get_database()['reports'].count_documents({'report_type': report_type} if report_type else {})

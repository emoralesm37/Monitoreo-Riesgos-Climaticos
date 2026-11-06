from pymongo.errors import PyMongoError

from app.database import audit_collection
from app.models import AuditEvent, AuditEventCreate


def create_audit_event(data: AuditEventCreate) -> AuditEvent:
    event = AuditEvent(**data.model_dump())

    document = event.model_dump(mode="json")

    try:
        audit_collection.insert_one(document)
    except PyMongoError:
        raise

    return event

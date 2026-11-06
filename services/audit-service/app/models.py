from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class AuditEventCreate(BaseModel):
    service: str = Field(min_length=1)
    action: str = Field(min_length=1)
    user_id: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    result: str = Field(min_length=1)
    details: dict[str, Any] = Field(default_factory=dict)


class AuditEvent(AuditEventCreate):
    event_id: str = Field(
        default_factory=lambda: str(uuid4())
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

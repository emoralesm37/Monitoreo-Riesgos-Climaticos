from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ReportType(str, Enum):
    COMMUNITIES = "communities"
    SENSORS = "sensors"
    READINGS = "readings"
    ALERTS = "alerts"
    EVENTS = "events"
    SENSOR_STATUS = "sensor_status"
    CLIMATE_STATISTICS = "climate_statistics"
    EXECUTIVE = "executive"


class ReportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportMetadata(BaseModel):
    report_type: ReportType
    user_id: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    parameters: dict[str, Any] = Field(default_factory=dict)
    status: ReportStatus = ReportStatus.PENDING
    file_name: str | None = None
    file_path: str | None = None
    downloaded_at: datetime | None = None

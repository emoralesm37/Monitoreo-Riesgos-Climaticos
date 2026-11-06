from fastapi import FastAPI

app = FastAPI(
    title="ClimateGuard Audit Service",
    description="Microservicio de auditoría de ClimateGuard",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "service": "audit-service",
        "status": "running",
        "message": "ClimateGuard Audit Service disponible",
    }


from fastapi import Depends, HTTPException
from pymongo.errors import PyMongoError

from app.models import AuditEvent, AuditEventCreate
from app.repository import create_audit_event
from app.security import verify_service_key


@app.post(
    "/api/audit/events",
    response_model=AuditEvent,
    status_code=201,
    dependencies=[Depends(verify_service_key)],
)
def register_audit_event(event: AuditEventCreate):
    try:
        return create_audit_event(event)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible registrar el evento de auditoría",
        )

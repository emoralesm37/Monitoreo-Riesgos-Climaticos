import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


def verify_service_key(
    x_service_key: str | None = Header(default=None),
) -> None:
    if not x_service_key or not secrets.compare_digest(
        x_service_key,
        settings.audit_service_key,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clave de servicio inválida o ausente",
        )

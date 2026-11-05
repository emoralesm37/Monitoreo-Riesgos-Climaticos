from fastapi import FastAPI, HTTPException, Depends
from app.database import check_database_connection
from app.security import require_administrator
from fastapi.security import HTTPAuthorizationCredentials
from app.security import bearer_scheme
from app.report_service import create_communities_report_from_api
from app.community_client import CommunityServiceError
from app.repository import list_report_metadata
from fastapi.responses import FileResponse
from app.report_download import get_report_file, ReportDownloadError
from app.report_service import create_sensors_report_from_api
from app.sensor_client import SensorServiceError

app = FastAPI(
    title="ClimateGuard Report Service",
    description="Microservicio de generación y consulta de reportes",
    version="1.0.0"
)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "report-service"
    }


@app.get("/health/database", tags=["Health"])
def database_health_check():
    if not check_database_connection():
        raise HTTPException(
            status_code=503,
            detail="MongoDB no disponible"
        )

    return {
        "status": "healthy",
        "service": "report-service",
        "database": "connected"
    }

@app.get("/api/reports/admin-check", tags=["Reports"])
def reports_admin_check(
    user: dict = Depends(require_administrator),
    ):
    return {
        "status": "authorized",
        "service": "report-service",
        "role": user["role"]
    }

@app.post("/api/reports/communities", tags=["Reports"])
def generate_communities_report(
    user: dict = Depends(require_administrator),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ):
    try:
        report_id, pdf_path = create_communities_report_from_api(
            access_token=credentials.credentials,
            user_id=user["sub"],
        )

        return {
            "status": "completed",
            "report_id": report_id,
            "file_name": pdf_path.name,
            "message": "Reporte de comunidades generado correctamente",
        }

    except CommunityServiceError:
        raise HTTPException(
            status_code=502,
            detail="No fue posible obtener los datos del servicio de comunidades",
        )

@app.post("/api/reports/sensors", tags=["Reports"])
def generate_sensors_report(
    user: dict = Depends(require_administrator),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ):
    """
    Genera un reporte PDF de sensores registrados.
    Acceso exclusivo para administradores.
    """

    try:
        report_id, pdf_path = create_sensors_report_from_api(
            access_token=credentials.credentials,
            user_id=user["sub"],
        )

        return {
            "status": "completed",
            "report_id": report_id,
            "file_name": pdf_path.name,
            "message": "Reporte de sensores generado correctamente",
        }

    except SensorServiceError:
        raise HTTPException(
            status_code=502,
            detail="No fue posible obtener los datos del servicio de sensores",
        )

@app.get("/api/reports/history", tags=["Reports"])
def get_reports_history(
    limit: int = 50,
    user: dict = Depends(require_administrator),
    ):
    """
    Consulta el historial de reportes generados.
    Acceso exclusivo para administradores.
    """

    if not 1 <= limit <= 100:
        raise HTTPException(
            status_code=422,
            detail="El límite debe estar entre 1 y 100",
        )

    reports = list_report_metadata(limit=limit)

    return {
        "total": len(reports),
        "reports": reports,
    }

@app.get("/api/reports/{report_id}/download", tags=["Reports"])
def download_report(
    report_id: str,
    user: dict = Depends(require_administrator),
    ):
    """
    Descarga un reporte PDF previamente generado.
    Acceso exclusivo para administradores.
    """

    try:
        pdf_path = get_report_file(report_id)

    except ReportDownloadError:
        raise HTTPException(
            status_code=404,
            detail="El reporte solicitado no está disponible",
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=pdf_path.name,
    )
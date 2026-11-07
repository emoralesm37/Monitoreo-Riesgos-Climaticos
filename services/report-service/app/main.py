from fastapi import FastAPI, HTTPException, Depends, Query
from typing import Literal
from pymongo.errors import PyMongoError
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.report_filters import SensorFilters, ReadingFilters, ExtendedFilters
from app.sensor_client import SensorServiceError, ReportLimitError
from app.report_service import create_data_report_from_api
from app.repository import count_reports
from app.database import check_database_connection
from app.security import require_administrator
from fastapi.security import HTTPAuthorizationCredentials
from app.security import bearer_scheme
from app.report_service import create_communities_report_from_api
from app.community_client import CommunityServiceError
from app.repository import list_report_metadata
from fastapi.responses import FileResponse
from app.report_download import get_report_file, ReportDownloadError
from app.repository import update_report_metadata
from datetime import datetime, timezone

app = FastAPI(
    title="ClimateGuard Report Service",
    description="Microservicio de generación y consulta de reportes",
    version="1.0.0"
)


@app.exception_handler(PyMongoError)
def storage_error(request, error):
    return JSONResponse(status_code=503, content={'detail': 'Almacenamiento de reportes no disponible.'})


@app.exception_handler(RequestValidationError)
def validation_error(request, error):
    return JSONResponse(status_code=422, content={'detail': 'Filtros de reporte inválidos.'})


def generate_data(report_type, filters, user, credentials):
    try:
        report_id, pdf, count = create_data_report_from_api(report_type,
            credentials.credentials, user['sub'], filters.model_dump(mode='json', exclude_none=True))
        return {'status':'completed', 'report_id':report_id, 'file_name':pdf.name,
            'row_count':count, 'message':'Reporte generado correctamente'}
    except SensorServiceError:
        raise HTTPException(502, 'La fuente de datos no está disponible o su contrato no es válido.')
    except ReportLimitError:
        raise HTTPException(413, 'Más de 20000 lecturas; reduce el rango o selecciona un sensor.')


@app.post('/api/reports/sensors', tags=['Reports'])
def generate_sensors_report(filters: SensorFilters = SensorFilters(),
    user: dict = Depends(require_administrator),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    return generate_data('sensors', filters, user, credentials)


@app.post('/api/reports/readings', tags=['Reports'])
def generate_readings_report(filters: ReadingFilters = ReadingFilters(),
    user: dict = Depends(require_administrator),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    return generate_data('readings', filters, user, credentials)


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

@app.get("/api/reports/history", tags=["Reports"])
def get_reports_history(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    report_type: Literal['communities','sensors','readings','alerts','events','sensor_status','climate_statistics','executive'] | None = None,
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

    reports = list_report_metadata(limit=limit, skip=skip, report_type=report_type)

    return {
        "total": count_reports(report_type),
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

    update_report_metadata(report_id, {'downloaded_at': datetime.now(timezone.utc)})
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=pdf_path.name,
    )


@app.post('/api/reports/{report_type}', tags=['Reports'])
def generate_extended_report(report_type: Literal['alerts','events','sensor_status','climate_statistics','executive'],
    filters: ExtendedFilters = ExtendedFilters(), user: dict = Depends(require_administrator),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    return generate_data(report_type, filters, user, credentials)

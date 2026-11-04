from fastapi import FastAPI, HTTPException

from app.database import check_database_connection

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

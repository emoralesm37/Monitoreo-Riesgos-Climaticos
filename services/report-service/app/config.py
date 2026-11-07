from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Raíz del repositorio ClimateGuard
ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # MongoDB
    mongo_host: str = "127.0.0.1"
    mongo_port: int = 27017
    mongo_database: str = "ClimateGuardReports"
    mongo_report_username: str
    mongo_report_password: str

    # Seguridad JWT
    jwt_issuer: str
    jwt_audience: str
    jwt_access_secret: str
    community_service_url: str
    sensor_service_url: str = "http://host.docker.internal:5147"

    model_config = SettingsConfigDict(
        env_file=(
            ROOT_DIR / "infrastructure/mongodb/.env",
            ROOT_DIR / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

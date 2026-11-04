from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_host: str = "127.0.0.1"
    mongo_port: int = 27017
    mongo_database: str = "ClimateGuardReports"
    mongo_report_username: str
    mongo_report_password: str
    jwt_issuer: str = "ClimateGuard.Auth"
    jwt_audience: str = "ClimateGuard.Services"
    jwt_access_secret: str

    model_config = SettingsConfigDict(
        env_file="../../infrastructure/mongodb/.env",
        extra="ignore"
    )


settings = Settings()

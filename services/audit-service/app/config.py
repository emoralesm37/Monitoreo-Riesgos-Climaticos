from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://127.0.0.1:27017"
    mongodb_database: str = "ClimateGuardAudit"
    mongo_audit_username: str
    mongo_audit_password: str
    mongodb_collection: str = "audit_events"
    audit_service_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

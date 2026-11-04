from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings


client = MongoClient(
    host=settings.mongo_host,
    port=settings.mongo_port,
    username=settings.mongo_report_username,
    password=settings.mongo_report_password,
    authSource=settings.mongo_database,
    serverSelectionTimeoutMS=5000,
)


def get_database() -> Database:
    return client[settings.mongo_database]


def check_database_connection() -> bool:
    try:
        database = get_database()
        result = database.command("ping")
        return result.get("ok") == 1
    except Exception:
        return False


def close_database_connection() -> None:
    client.close()

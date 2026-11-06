from pymongo import MongoClient
from app.config import settings

client = MongoClient(
    settings.mongodb_url,
    username=settings.mongo_audit_username,
    password=settings.mongo_audit_password,
    authSource=settings.mongodb_database,
    serverSelectionTimeoutMS=5000,
)

database = client[settings.mongodb_database]
audit_collection = database[settings.mongodb_collection]

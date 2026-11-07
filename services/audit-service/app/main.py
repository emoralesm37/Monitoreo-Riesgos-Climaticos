import hashlib
import hmac
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError


class Settings(BaseSettings):
    mongo_host: str
    mongo_port: int = 27017
    mongo_database: str = 'ClimateGuardAudit'
    mongo_audit_username: str
    mongo_audit_password: str
    jwt_access_secret: str
    jwt_issuer: str
    jwt_audience: str
    audit_ingest_key: str = Field(min_length=32)
    model_config = SettingsConfigDict(extra='ignore', hide_input_in_errors=True)


settings = Settings()
client = MongoClient(host=settings.mongo_host, port=settings.mongo_port,
                     username=settings.mongo_audit_username, password=settings.mongo_audit_password,
                     authSource=settings.mongo_database, serverSelectionTimeoutMS=3000, tz_aware=True)
events = client[settings.mongo_database].events


@asynccontextmanager
async def lifespan(app):
    client.admin.command('ping')
    events.create_index('event_id', unique=True)
    events.create_index([('occurred_at', DESCENDING), ('event_id', ASCENDING)])
    for key in ['module', 'actor_id', 'action', 'result']:
        events.create_index([(key, ASCENDING), ('occurred_at', DESCENDING)])
    yield
    client.close()


app = FastAPI(title='ClimateGuard Audit', lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
bearer = HTTPBearer(auto_error=False)


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    # Do not echo invalid values, input bodies, headers or credentials.
    return JSONResponse(status_code=422, content={'detail': 'Invalid audit parameters'})


@app.exception_handler(PyMongoError)
async def storage_error(request, error):
    return JSONResponse(status_code=503, content={'detail': 'Audit storage unavailable'})


def administrator(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None:
        raise HTTPException(401, 'Authentication required')
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_access_secret, algorithms=['HS256'],
                            issuer=settings.jwt_issuer, audience=settings.jwt_audience,
                            options={'require': ['sub', 'exp', 'iss', 'aud']})
        UUID(claims['sub'])
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, 'Invalid access token') from None
    if claims.get('role') != 'Administrador' or claims.get('type', 'access') != 'access':
        raise HTTPException(403, 'Administrator required')
    return claims


class Event(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    event_id: UUID
    occurred_at: datetime
    actor_id: UUID | None = None
    actor_name: str = Field(max_length=100)
    actor_role: str = Field(max_length=50)
    module: Literal['auth', 'users', 'communities', 'sensors', 'alerts', 'reports', 'alert-rules']
    action: Literal['login', 'logout', 'create', 'update', 'delete', 'resolve', 'status', 'manual', 'reset', 'ingest']
    entity_id: str | None = Field(default=None, max_length=36, pattern=r'^[0-9a-fA-F-]+$')
    result: Literal['CONFIRMED', 'FAILED', 'UNKNOWN']
    http_status: int = Field(ge=0, le=599)

    @field_validator('occurred_at')
    @classmethod
    def utc_required(cls, value):
        if value.tzinfo is None or value.utcoffset().total_seconds() != 0:
            raise ValueError('UTC required')
        return value


def store_event(event: Event):
    doc = event.model_dump(mode='json')
    # BSON dates have millisecond precision. Compare sanitized fields, not stored hashes.
    doc['occurred_at'] = event.occurred_at.astimezone(timezone.utc).replace(
        microsecond=(event.occurred_at.microsecond // 1000) * 1000)
    try:
        events.insert_one(doc.copy())
        return {'event_id': str(event.event_id), 'duplicate': False}
    except DuplicateKeyError:
        existing = events.find_one({'event_id': str(event.event_id)}, {'_id': 0})
        if existing != doc:
            raise HTTPException(409, 'Event identity conflict') from None
        return {'event_id': str(event.event_id), 'duplicate': True}


@app.post('/internal/events')
async def ingest(request: Request):
    # Only the Gateway holds this independent signing key. A user JWT is insufficient.
    raw = await request.body()
    if len(raw) > 4096:
        raise HTTPException(413, 'Event too large')
    timestamp = request.headers.get('x-audit-timestamp', '')
    signature = request.headers.get('x-audit-signature', '')
    try:
        if abs(time.time() - int(timestamp)) > 60:
            raise ValueError()
    except ValueError:
        raise HTTPException(401, 'Invalid service authentication') from None
    expected = hmac.new(settings.audit_ingest_key.encode(), timestamp.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(401, 'Invalid service authentication')
    try:
        event = Event.model_validate_json(raw)
    except ValueError:
        raise HTTPException(422, 'Invalid audit event') from None
    # MongoDB operations run outside the async event loop.
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(store_event, event)


@app.get('/api/audit/events', dependencies=[Depends(administrator)])
def query_events(page: int = Query(1, ge=1, le=10000), page_size: int = Query(25, ge=1, le=100),
                 module: str | None = Query(None, max_length=30),
                 action: str | None = Query(None, max_length=30),
                 actor: UUID | None = None, result: Literal['CONFIRMED', 'FAILED', 'UNKNOWN'] | None = None,
                 start: datetime | None = None, end: datetime | None = None):
    query = {}
    for key, value in [('module', module), ('action', action), ('actor_id', str(actor) if actor else None), ('result', result)]:
        if value is not None:
            query[key] = value
    if start or end:
        if any(d and (d.tzinfo is None or d.utcoffset().total_seconds() != 0) for d in [start, end]):
            raise HTTPException(422, 'UTC dates required')
        if start and end and start > end:
            raise HTTPException(422, 'Invalid date range')
        query['occurred_at'] = {k: v for k, v in [('$gte', start), ('$lte', end)] if v}
    total = events.count_documents(query)
    items = list(events.find(query, {'_id': 0, 'payload_hash': 0}).sort([('occurred_at', -1), ('event_id', 1)])
                 .skip((page - 1) * page_size).limit(page_size))
    return {'items': items, 'total': total, 'page': page, 'page_size': page_size}


@app.get('/health')
def health():
    client.admin.command('ping')
    return {'status': 'ok'}

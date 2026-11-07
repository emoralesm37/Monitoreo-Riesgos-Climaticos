import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

for name, value in {'MONGO_HOST': '127.0.0.1', 'MONGO_AUDIT_USERNAME': 'unit',
                    'MONGO_AUDIT_PASSWORD': 'unit-only', 'JWT_ACCESS_SECRET': 'unit-secret-not-real-' * 3,
                    'JWT_ISSUER': 'unit', 'JWT_AUDIENCE': 'unit', 'AUDIT_INGEST_KEY': 'unit-signing-key-' * 3}.items():
    os.environ.setdefault(name, value)
from app import main


@pytest.fixture
def api(monkeypatch):
    # No lifespan and no Mongo connection: isolated unit tests only.
    monkeypatch.setattr(main, 'events', MagicMock())
    return TestClient(main.app)


def token(role='Administrador', **extra):
    return {'Authorization': 'Bearer ' + jwt.encode({'sub': str(uuid4()), 'role': role,
            'iss': main.settings.jwt_issuer, 'aud': main.settings.jwt_audience,
            'exp': datetime.now(timezone.utc) + timedelta(minutes=2), **extra}, main.settings.jwt_access_secret, algorithm='HS256')}


def payload():
    return {'event_id': str(uuid4()), 'occurred_at': datetime.now(timezone.utc).isoformat(),
            'actor_id': str(uuid4()), 'actor_name': 'Unit actor', 'actor_role': 'Administrador',
            'module': 'users', 'action': 'update', 'entity_id': str(uuid4()), 'result': 'CONFIRMED', 'http_status': 200}


def signed(data, age=0):
    raw = json.dumps(data).encode()
    ts = str(int(time.time()) - age)
    signature = hmac.new(main.settings.audit_ingest_key.encode(), ts.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return {'content': raw, 'headers': {'X-Audit-Timestamp': ts, 'X-Audit-Signature': signature, 'Content-Type': 'application/json'}}


def test_no_token_cannot_read(api):
    assert api.get('/api/audit/events').status_code == 401


def test_operator_cannot_read(api):
    assert api.get('/api/audit/events', headers=token('Operador')).status_code == 403


def test_wrong_issuer_rejected(api):
    assert api.get('/api/audit/events', headers=token(iss='wrong')).status_code == 401


def test_user_jwt_cannot_forge_events(api):
    assert api.post('/internal/events', json=payload(), headers=token()).status_code == 401
    main.events.insert_one.assert_not_called()


def test_old_signature_rejected(api):
    assert api.post('/internal/events', **signed(payload(), age=120)).status_code == 401


def test_signed_event_and_persistent_idempotency(api):
    data = payload()
    assert api.post('/internal/events', **signed(data)).json()['duplicate'] is False
    doc = main.events.insert_one.call_args.args[0]
    main.events.insert_one.side_effect = DuplicateKeyError('unit duplicate')
    main.events.find_one.return_value = doc
    assert api.post('/internal/events', **signed(data)).json()['duplicate'] is True
    data['result'] = 'FAILED'
    assert api.post('/internal/events', **signed(data)).status_code == 409


def test_signed_ingestion_action_is_persisted(api):
    data={**payload(),'module':'sensors','action':'ingest','entity_id':'3','http_status':201}
    response=api.post('/internal/events',**signed(data))
    assert response.status_code==200
    assert main.events.insert_one.call_args.args[0]['action']=='ingest'


@pytest.mark.parametrize('changes', [{'password': 'DO_NOT_ECHO'}, {'occurred_at': '2026-11-05T12:00:00'}, {'metadata': {'token': 'DO_NOT_ECHO'}}])
def test_sensitive_fields_and_non_utc_rejected(api, changes):
    response = api.post('/internal/events', **signed({**payload(), **changes}))
    assert response.status_code == 422
    assert 'DO_NOT_ECHO' not in response.text


def test_query_filters_and_limits(api):
    main.events.count_documents.return_value = 0
    main.events.find.return_value.sort.return_value.skip.return_value.limit.return_value = []
    actor = str(uuid4())
    response = api.get('/api/audit/events', params={'module': 'users', 'actor': actor, 'page': 2}, headers=token())
    assert response.status_code == 200
    assert response.json()['page'] == 2
    assert main.events.count_documents.call_args.args[0] == {'module': 'users', 'actor_id': actor}
    assert api.get('/api/audit/events?page_size=101', headers=token()).status_code == 422
    assert api.get('/api/audit/events?start=2026-11-05T12:00:00', headers=token()).status_code == 422

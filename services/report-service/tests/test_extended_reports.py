from datetime import datetime, timezone, timedelta
import pytest
from app import extended_reports as r
from app.report_filters import ExtendedFilters

SENSOR={'sensorId':1,'name':'TEST sensor','sensorType':'TEMP','sensorTypeId':1,'unit':'C','communityId':2,'community':'TEST community','isActive':True,'lastUpdatedAt':None}

@pytest.fixture
def data(monkeypatch):
    monkeypatch.setattr(r,'get_sensors',lambda token:[SENSOR])
    monkeypatch.setattr(r,'get_communities_raw',lambda token:[{'communityId':2}])
    monkeypatch.setattr(r,'get_all_sensor_readings',lambda *args,**kwargs:[{'value':0,'timestamp':'2026-11-06T12:00:00Z'},{'value':10,'timestamp':'2026-11-06T13:00:00Z'}])
    alerts=[{'alertId':1,'sensorId':1,'communityId':2,'status':'ACTIVA','severity':'ROJO','phenomenon':'SEQUIA','createdAt':'2026-11-06T12:00:00Z','ruleId':3}]
    monkeypatch.setattr(r,'fetch_list',lambda token,path: alerts if path=='/api/alerts' else [{'alertRuleId':3,'minimumValue':0,'maximumValue':40}])

def test_stats_keep_zero_and_compute_measured_only(data):
    result=r.collect('climate_statistics','technical',{})
    assert result['rows'][0]['mínimo']==0
    assert result['rows'][0]['promedio']==5
    assert result['rows'][0]['muestras']==2
    assert any('Lluvia acumulada no disponible' in n for n in result['notes'])

def test_alert_filters_apply_to_persisted_created_time(data):
    assert not r.collect('alerts','technical',{'startDate':'2026-11-07T00:00:00Z'})['rows']
    assert not r.collect('alerts','technical',{'communityId':99})['rows']
    row=r.collect('alerts','technical',{})['rows'][0]
    assert row['minimumValue']==0 and row['maximumValue']==40

def test_event_provenance_not_invented(data):
    result=r.collect('events','technical',{})
    assert len(result['rows'])==1
    assert any('no es un registro independiente' in n for n in result['notes'])

def test_sensor_without_communication_claim(data):
    row=r.collect('sensor_status','technical',{})['rows'][0]
    assert row['estadoLecturas']=='Sin lecturas registradas'

def test_executive_counts_from_real_sources(data):
    rows=r.collect('executive','technical',{})['rows']
    counts={r['indicador']:r['valor'] for r in rows}
    assert counts['Mediciones en rango']==2 and counts['Alertas activas']==1

def test_rainfall_requires_explicit_semantics_and_never_estimates_resets(data,monkeypatch):
    monkeypatch.setattr(r,'get_sensors',lambda token:[{**SENSOR,'sensorType':'LLUVIA','unit':'mm'}])
    assert r.collect('climate_statistics','technical',{})['rows'][0]['lluviaAcumulada'] is None
    assert r.collect('climate_statistics','technical',{'accumulationMode':'increments'})['rows'][0]['lluviaAcumulada']==10
    assert r.collect('climate_statistics','technical',{'accumulationMode':'counter'})['rows'][0]['lluviaAcumulada']==10
    monkeypatch.setattr(r,'get_all_sensor_readings',lambda *a,**kw:[{'value':10,'timestamp':'2026-11-06T12:00:00Z'},{'value':2,'timestamp':'2026-11-06T13:00:00Z'}])
    assert r.collect('climate_statistics','technical',{'accumulationMode':'counter'})['rows'][0]['lluviaAcumulada'] is None

@pytest.mark.parametrize('body',[{'staleAfterMinutes':0},{'severity':'fake'},{'startDate':'2026-11-07T00:00:00Z','endDate':'2026-11-06T00:00:00Z'}])
def test_extended_filter_validation(body):
    with pytest.raises(ValueError):ExtendedFilters(**body)

@pytest.mark.parametrize('permissions,issuer,audience,expected',[
    ([], 'unit','unit',403),(['reports:read'],'unit','unit',403),
    (['reports:generate'],'wrong','unit',401),(['reports:generate'],'unit','wrong',401),
    (['reports:generate'],'unit','unit',200)])
def test_extended_generation_enforces_signed_claims(monkeypatch,permissions,issuer,audience,expected):
    import time,jwt
    from pathlib import Path
    from fastapi.testclient import TestClient
    from app import main
    from app.config import settings
    main.app.dependency_overrides.clear()
    token=jwt.encode({'sub':'unit-user','role':'Administrador','permissions':permissions,'iss':issuer,'aud':audience,'exp':time.time()+60},settings.jwt_access_secret,algorithm='HS256')
    monkeypatch.setattr(main,'create_data_report_from_api',lambda *a:('unit',Path('unit.pdf'),0))
    response=TestClient(main.app).post('/api/reports/alerts',json={},headers={'Authorization':'Bearer '+token})
    assert response.status_code==expected

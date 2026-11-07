import os
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

for key, value in {'MONGO_REPORT_USERNAME':'unit', 'MONGO_REPORT_PASSWORD':'synthetic',
    'JWT_ACCESS_SECRET':'synthetic-reports-test-key-01234567890123456789',
    'JWT_ISSUER':'unit', 'JWT_AUDIENCE':'unit', 'COMMUNITY_SERVICE_URL':'http://unit',
    'SENSOR_SERVICE_URL':'http://unit'}.items():
    os.environ[key] = value

from app import main, report_service as reports, sensor_client as source, pdf_generator as pdf
from app.report_filters import ReadingFilters
from app.reading_filters import filter_readings
from app.security import require_administrator
from app.sensor_client import SensorServiceError, ReportLimitError

SENSOR = {'sensorId':1,'name':'Official sensor','sensorTypeId':2,'sensorType':'TEMP',
    'communityId':3,'isActive':True,'lastValue':0}
ROW = {'sensorReadingId':1,'sensorId':1,'value':0,'timestamp':'2026-11-06T12:00:00Z',
    'evaluationRecorded':True,'evaluationDelivered':True}

@pytest.fixture
def api(monkeypatch):
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides[require_administrator] = lambda: {'sub':'unit-user','role':'Administrador'}
    client = TestClient(main.app, raise_server_exceptions=False)
    yield client
    main.app.dependency_overrides.clear()

@pytest.fixture
def data(monkeypatch):
    monkeypatch.setattr(source, 'get_sensors', lambda _: [SENSOR])
    monkeypatch.setattr(source, 'get_sensor_types', lambda _: [{'sensorTypeId':2,'unit':'C'}])
    monkeypatch.setattr(source, 'get_communities_raw', lambda _: [{'communityId':3,'name':'Official community','department':'Real department'}])
    monkeypatch.setattr(source, 'get_all_sensor_readings', lambda *a, **kw: [ROW])

@pytest.mark.parametrize('body',[{'sensorId':0},{'communityId':-1},{'startDate':'invalid'},
    {'startDate':'2026-11-07T00:00:00Z','endDate':'2026-11-06T00:00:00Z'},
    {'startDate':'2026-11-06T00:00:00'}, {'evaluationStatus':'normal'}, {'rules':[]}])
def test_invalid_filters_rejected(api, body):
    assert api.post('/api/reports/readings',json=body,headers={'Authorization':'Bearer synthetic'}).status_code == 422

@pytest.mark.parametrize('kind', ['sensors','readings'])
def test_generation_contract(api, monkeypatch, kind):
    create=MagicMock(return_value=('mongo-id',Path('real.pdf'),2))
    monkeypatch.setattr(main,'create_data_report_from_api',create)
    result=api.post('/api/reports/'+kind,json={'communityId':3,'isActive':False},headers={'Authorization':'Bearer synthetic'})
    assert result.status_code==200
    assert result.json()['row_count']==2
    assert create.call_args.args == (kind,'synthetic','unit-user',{'communityId':3,'isActive':False})

@pytest.mark.parametrize('kind', ['sensors','readings'])
def test_missing_jwt_401(kind):
    main.app.dependency_overrides.clear()
    assert TestClient(main.app).post('/api/reports/'+kind,json={}).status_code==401

@pytest.mark.parametrize('kind', ['sensors','readings'])
def test_viewer_403(kind):
    import jwt
    from app.config import settings
    import time
    token=jwt.encode({'sub':'unit-user','role':'Viewer','iss':'unit','aud':'unit','exp':time.time()+60},settings.jwt_access_secret,algorithm='HS256')
    main.app.dependency_overrides.clear()
    assert TestClient(main.app).post('/api/reports/'+kind,json={},headers={'Authorization':'Bearer '+token}).status_code==403


def test_sources_filters_zero_and_real_status(data):
    rows=reports.collect_report_rows('sensors','synthetic',{'communityId':3,'isActive':True})
    assert rows[0]['last_value']==0
    assert rows[0]['community_name']=='Official community'
    assert reports.collect_report_rows('sensors','synthetic',{'isActive':False})==[]
    rows=reports.collect_report_rows('readings','synthetic',{})
    assert rows[0]['value']==0 and rows[0]['status'].startswith('Evaluaci')
    assert reports.collect_report_rows('readings','synthetic',{'evaluationStatus':'pending'})==[]


def test_pagination_uses_same_snapshot(monkeypatch):
    calls=[]
    def fetch(_token,path,params):
        calls.append((path,params.copy()))
        n=len(calls)
        return {'readings':[{**ROW,'sensorReadingId':n}], 'hasMore':n==1,'snapshotId':2,'nextAfterId':n}
    monkeypatch.setattr(source,'fetch_json',fetch)
    result=source.get_all_sensor_readings('synthetic',1,{'startDate':'2026-11-06T00:00:00Z'})
    assert len(result)==2
    assert calls[1][1]['snapshotId']==2 and calls[1][1]['afterId']==1
    assert calls[0][1]['startDate'].endswith('Z')

@pytest.mark.parametrize('fault',['stuck','wrong-sensor','changed-snapshot','bad-shape'])
def test_invalid_pagination_never_completes(monkeypatch,fault):
    count=0
    def fetch(*args):
        nonlocal count
        count+=1
        if fault=='bad-shape': return []
        row={**ROW,'sensorReadingId':count,'sensorId':2 if fault=='wrong-sensor' else 1}
        return {'readings':[] if fault=='stuck' else [row], 'hasMore':True,
            'snapshotId':2 if count==1 or fault!='changed-snapshot' else 3,
            'nextAfterId':0 if fault=='stuck' else count}
    monkeypatch.setattr(source,'fetch_json',fetch)
    with pytest.raises(SensorServiceError): source.get_all_sensor_readings('synthetic',1,{})


def test_never_truncates_over_limit(monkeypatch):
    monkeypatch.setattr(source,'fetch_json',lambda *a:{'readings':[ROW], 'hasMore':False,'snapshotId':1,'nextAfterId':1})
    with pytest.raises(ReportLimitError): source.get_all_sensor_readings('synthetic',1,{},max_rows=0)

@pytest.mark.parametrize('kind',['sensors','readings'])
def test_real_pdf_and_persistent_metadata(data,monkeypatch,tmp_path,kind):
    saved=[]; updates=[]
    monkeypatch.setattr(reports,'save_report_metadata',lambda report: saved.append(report) or 'mongo-id')
    monkeypatch.setattr(reports,'update_report_metadata',lambda ident,values: updates.append(values) or True)
    monkeypatch.setattr(pdf,'GENERATED_DIR',tmp_path)
    ident,file,count=reports.create_data_report_from_api(kind,'synthetic','unit-user',{'sensorId':1})
    assert ident=='mongo-id' and count==1
    assert file.read_bytes().startswith(b'%PDF-') and file.stat().st_size>1000
    assert saved[0].parameters=={'sensorId':1}
    assert updates[-1]['status']=='completed' and updates[-1]['row_count']==1


def test_failed_source_marks_history_failed(monkeypatch):
    updates=[]
    monkeypatch.setattr(reports,'save_report_metadata',lambda _: 'failed-id')
    monkeypatch.setattr(reports,'update_report_metadata',lambda _,values:updates.append(values) or True)
    monkeypatch.setattr(reports,'collect_report_rows',MagicMock(side_effect=SensorServiceError()))
    with pytest.raises(SensorServiceError): reports.create_data_report_from_api('readings','synthetic','unit-user',{})
    assert updates[-1]=={'status':'failed'}


def test_history_pages_and_filters(api,monkeypatch):
    rows=MagicMock(return_value=[])
    monkeypatch.setattr(main,'list_report_metadata',rows)
    monkeypatch.setattr(main,'count_reports',lambda _:73)
    result=api.get('/api/reports/history?limit=50&skip=50&report_type=readings')
    assert result.json()=={'total':73,'reports':[]}
    rows.assert_called_once_with(limit=50,skip=50,report_type='readings')
    assert api.get('/api/reports/history?skip=-1').status_code==422


def test_community_pdf_regression(monkeypatch,tmp_path):
    monkeypatch.setattr(pdf,'GENERATED_DIR',tmp_path)
    file=pdf.generate_communities_pdf([])
    assert file.read_bytes().startswith(b'%PDF-')


def test_html_escapes_upstream_names():
    html=pdf.environment.get_template('sensors.html').render(sensors=[{'name':'<script>unsafe</script>'}],parameters={})
    assert '<script>unsafe</script>' not in html
    assert '&lt;script&gt;' in html

@pytest.mark.parametrize('kind',['sensors','readings'])
@pytest.mark.parametrize('error,status',[(SensorServiceError(),502),(ReportLimitError(),413)])
def test_upstream_errors_never_report_success(api,monkeypatch,kind,error,status):
    monkeypatch.setattr(main,'create_data_report_from_api',MagicMock(side_effect=error))
    response=api.post('/api/reports/'+kind,json={},headers={'Authorization':'Bearer synthetic'})
    assert response.status_code==status
    assert 'report_id' not in response.json()


def test_download_records_time_and_preserves_pdf(api,monkeypatch,tmp_path):
    file=tmp_path/'existing.pdf';file.write_bytes(b'%PDF-test-existing')
    monkeypatch.setattr(main,'get_report_file',lambda _:file)
    update=MagicMock(return_value=True)
    monkeypatch.setattr(main,'update_report_metadata',update)
    response=api.get('/api/reports/persisted-id/download')
    assert response.status_code==200 and response.headers['content-type']=='application/pdf'
    assert response.content==b'%PDF-test-existing'
    assert update.call_args.args[0]=='persisted-id'
    assert update.call_args.args[1]['downloaded_at'].tzinfo is not None


def test_source_paths_use_local_catalog_and_forward_jwt(monkeypatch):
    requests=[]
    def request(request):
        import httpx
        requests.append(request)
        return httpx.Response(200,json=[])
    import httpx
    original=httpx.Client
    monkeypatch.setattr(source.httpx,'Client',lambda **kw:original(transport=httpx.MockTransport(request),**kw))
    source.get_sensor_types('synthetic')
    assert requests[0].url.path=='/api/catalogs/sensor-types'
    assert requests[0].headers['Authorization']=='Bearer synthetic'


def test_no_false_completed_history_when_metadata_write_fails(data,monkeypatch,tmp_path):
    calls=[]
    monkeypatch.setattr(reports,'save_report_metadata',lambda _: 'id')
    def update(_,values):
        calls.append(values)
        return values['status']!='completed'
    monkeypatch.setattr(reports,'update_report_metadata',update)
    monkeypatch.setattr(pdf,'GENERATED_DIR',tmp_path)
    with pytest.raises(RuntimeError): reports.create_data_report_from_api('sensors','synthetic','user',{})
    assert calls[-1]['status']=='failed'
    assert not list(tmp_path.glob('*.pdf'))


def test_mongo_decodes_history_dates_with_utc_timezone():
    from app.database import client
    assert client.options.codec_options.tz_aware is True

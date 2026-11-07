"""Real HTTPS/Gateway acceptance. Only clearly labeled TEST fixtures, retained.
No physical hardware, real provider accounts, secrets, cookies or tokens printed.
"""
import concurrent.futures
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import time
import uuid

spec=importlib.util.spec_from_file_location('b',Path(__file__).with_name('business-e2e-private.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
RESULTS=[];LAST='initialization'

def check(name,ok,**details):
    global LAST
    LAST=name;RESULTS.append({'name':name,'passed':bool(ok),**details})
    if not ok:raise RuntimeError('Assertion failed')

def hit(name,path,method='GET',body=None,token=None,expected=(200,),binary=False):
    global LAST
    LAST=name;headers={'Origin':'https://'+b.HOST}
    if token:headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']='application/json'
    c=b.LocalIngress(b.HOST,timeout=40);c.request(method,path,body=None if body is None else json.dumps(body),headers=headers)
    r=c.getresponse();raw=r.read();c.close();check(name,r.status in expected,status=r.status)
    return raw if binary else json.loads(raw) if raw else None

def run():
    admin=json.loads((b.PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    viewer=json.loads((b.PRIVATE/'e2e-state.json').read_text())['viewer']
    session=hit('Admin login','/api/auth/login','POST',{'email':admin['email'],'password':admin['password']})
    token=session['accessToken'];owner=b.claims(token)['sub']
    vs=hit('Viewer login','/api/auth/login','POST',viewer);vt=vs['accessToken']
    suffix=uuid.uuid4().hex[:8]
    community=hit('Create PostgreSQL community','/api/communities','POST',{'name':'TEST K3S F3 independiente '+suffix,
        'municipality':'Guatemala','department':'Guatemala','country':'Guatemala','latitude':None,'longitude':None,
        'description':'PRUEBA TECNICA: comunidad creada en PostgreSQL, no ubicacion fisica.'},token,(201,))
    cid=community['communityId'];check('New Community sensorCount is zero',community['sensorCount']==0)
    sensor=hit('Create sensor with independent Community ID','/api/sensors','POST',{'name':'TEST K3S protocolo UNO '+suffix,'sensorTypeId':1,'communityId':cid},token,(201,))
    sid=sensor['sensorId'];unit=sensor['unit']
    linked=hit('Count via Community -> Sensor API','/api/communities/'+str(cid),token=token)
    check('Authoritative sensorCount is one',linked['sensorCount']==1)
    device='TEST_K3S_UNO_'+suffix
    binding={'deviceId':device,'ownerUserId':owner}
    hit('Viewer cannot bind device',f'/api/sensors/{sid}/devices','POST',binding,vt,(403,))
    hit('Bind dedicated test device',f'/api/sensors/{sid}/devices','POST',binding,token,(201,))
    now=dt.datetime.now(dt.timezone.utc)
    body={'deviceId':device,'measurementId':'TEST_'+uuid.uuid4().hex,'value':45,'capturedAt':now.isoformat(),'unit':unit}
    path=f'/api/sensors/{sid}/readings/ingest'
    hit('Unauthenticated ingest rejected',path,'POST',body,expected=(401,))
    hit('Viewer ingest rejected',path,'POST',body,vt,(403,))
    hit('Unbound device rejected',path,'POST',{**body,'deviceId':'TEST_UNBOUND_'+suffix},token,(403,))
    hit('Wrong sensor binding rejected','/api/sensors/1/readings/ingest','POST',body,token,(403,))
    hit('Wrong unit rejected',path,'POST',{**body,'unit':'invalid-unit'},token,(400,))
    hit('Future timestamp rejected',path,'POST',{**body,'capturedAt':(now+dt.timedelta(days=1)).isoformat()},token,(400,))
    hit('Excess precision rejected',path,'POST',{**body,'value':45.123},token,(400,))
    hit('Decimal extreme rejected safely',path,'POST',{**body,'value':-79228162514264337593543950335},token,(400,))
    hit('Missing value rejected',path,'POST',{k:v for k,v in body.items() if k!='value'},token,(400,))
    first=hit('Persist simulated hardware protocol measurement',path,'POST',body,token,(201,));rid=first['sensorReadingId']
    replay=hit('Exact retry deduplicated',path,'POST',body,token)
    check('Retry keeps reading identity',replay['duplicate'] and replay['sensorReadingId']==rid)
    hit('Conflicting duplicate rejected',path,'POST',{**body,'value':44},token,(409,))
    older={**body,'measurementId':'OLDER_'+suffix,'value':44,'capturedAt':(now-dt.timedelta(minutes=1)).isoformat()}
    hit('Out-of-order measurement retained',path,'POST',older,token,(201,))
    latest=hit('Latest sensor value after old measurement',f'/api/sensors/{sid}',token=token)
    check('Old reading cannot overwrite latest value',latest['lastValue']==45)
    concurrent_body={**body,'measurementId':'CONCURRENT_'+suffix,'value':47,'capturedAt':(now+dt.timedelta(seconds=1)).isoformat()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows=list(pool.map(lambda _:hit('Concurrent duplicate receipt',path,'POST',concurrent_body,token,(200,201)),range(4)))
    check('Concurrent retries share one persisted identity',len({row['sensorReadingId'] for row in rows})==1 and sum(not row['duplicate'] for row in rows)==1)
    readings=hit('Persisted ingestion readings',f'/api/sensors/{sid}/readings',token=token)
    check('Exactly three measurements persisted',len(readings)==3)
    evaluation=hit('Persisted evaluation delivery',f'/api/sensors/{sid}/readings/evaluation-status',token=token)
    check('All measurements evaluated by rules',len(evaluation)==3 and all(not x['alertEvaluationPending'] for x in evaluation))
    alerts=hit('Java persisted physical protocol alerts',f'/api/alerts?sensorId={sid}',token=token)
    check('No duplicate alerts for concurrent retries',len(alerts)==3)
    # Replace only Sensor and Community application Pods; no DB/volume deletion.
    for deployment in ['sensor-service','community-service']:
        r=subprocess.run(['k3s','kubectl','-n','climateguard','rollout','restart','deployment/'+deployment],capture_output=True)
        if r.returncode:raise RuntimeError('Controlled restart failed')
        r=subprocess.run(['k3s','kubectl','-n','climateguard','rollout','status','deployment/'+deployment,'--timeout=180s'],capture_output=True)
        if r.returncode:raise RuntimeError('Controlled rollout failed')
    time.sleep(3)
    retry=hit('Receipt survives Sensor Pod replacement',path,'POST',body,token)
    check('Persistent dedup identity after restart',retry['sensorReadingId']==rid and retry['duplicate'])
    row=hit('Community persists after Pod replacement','/api/communities/'+str(cid),token=token)
    check('Independent Community ID and association retained',row['communityId']==cid and row['sensorCount']==1)
    reports={}
    for kind in ['alerts','events','sensor_status','climate_statistics','executive']:
        hit('Viewer cannot generate '+kind,'/api/reports/'+kind,'POST',{},vt,(403,))
        result=hit('Generate '+kind+' PDF','/api/reports/'+kind,'POST',{'sensorId':sid,'communityId':cid},token)
        raw=hit('Download '+kind+' PDF','/api/reports/'+result['report_id']+'/download',token=token,binary=True)
        check('Valid PDF '+kind,raw.startswith(b'%PDF-') and len(raw)>1000)
        (b.EVIDENCE/('closure-'+kind+'.pdf')).write_bytes(raw)
        reports[kind]={'id':result['report_id'],'rows':result['row_count'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
        history=hit('Filtered persistent history '+kind,'/api/reports/history?report_type='+kind,token=token)
        check('New report in typed history '+kind,any(x['_id']==result['report_id'] for x in history['reports']))
    hit('Invalid extended filter rejected','/api/reports/alerts','POST',{'staleAfterMinutes':0},token,(422,))
    for _ in range(10):
        audit=hit('Confirmed extended-report audit','/api/audit/events?module=reports&action=create&result=CONFIRMED',token=token)
        if audit['total']>=5:break
        time.sleep(1)
    check('Extended reports audited',audit['total']>=5)
    hit('Admin logout','/api/auth/logout','POST',{'refreshToken':session['refreshToken']})
    hit('Viewer logout','/api/auth/logout','POST',{'refreshToken':vs['refreshToken']})
    return {'communityId':cid,'sensorId':sid,'readingIds':[r['sensorReadingId'] for r in readings], 'reports':reports,
        'hardwareConnected':False,'dataProvenance':'TEST simulated protocol, NOT physical observations','githubReturn':'PENDING_CHROME_ANTIPHISHING'}

if __name__=='__main__':
    try:summary=run();passed=True
    except Exception as error:summary={'failedAt':LAST,'errorType':type(error).__name__};passed=False
    result={'atUtc':dt.datetime.now(dt.timezone.utc).isoformat(),'passed':passed,'checks':RESULTS,'summary':summary,'secretValuesPrinted':False}
    b.save(b.EVIDENCE/'closure-e2e.json',result);print(json.dumps(result));raise SystemExit(0 if passed else 1)

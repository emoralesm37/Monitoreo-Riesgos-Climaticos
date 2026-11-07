"""EC2-only E2E using NEW technical accounts/fixtures. No real OAuth account automation.

Passwords, signing keys and tokens never leave this process or appear in evidence.
All new business records are clearly TEST K3S and retained, never deleted.
"""
import base64
import datetime as dt
import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import time

HOST='climateguard.garher.lat'
PRIVATE=Path('/srv/climateguard-demo/private')
EVIDENCE=Path('/srv/climateguard-demo/evidence')
RESULTS=[]
LAST='initialization'
CONTEXT=ssl.create_default_context()

class LocalIngress(http.client.HTTPSConnection):
    def connect(self):
        # Fixed own-machine destination; validate the real hostname/certificate normally.
        self.sock=CONTEXT.wrap_socket(socket.create_connection(('127.0.0.1',443),30),server_hostname=HOST)

def request(name,path,expected=200,method='GET',token=None,body=None):
    global LAST
    LAST=name
    headers={'Origin':'https://'+HOST}
    if token: headers['Authorization']='Bearer '+token
    data=None
    if body is not None:
        data=json.dumps(body).encode()
        headers['Content-Type']='application/json'
    connection=LocalIngress(HOST,timeout=30)
    connection.request(method,path,body=data,headers=headers)
    response=connection.getresponse()
    raw=response.read()
    info={'name':name,'status':response.status,'expected':expected,'passed':response.status==expected}
    RESULTS.append(info)
    connection.close()
    if not info['passed']: raise RuntimeError('Unexpected HTTP status; response not printed')
    return raw

def api(*args,**kwargs): return json.loads(request(*args,**kwargs))
def check(name,passed):
    global LAST
    LAST=name
    RESULTS.append({'name':name,'passed':bool(passed)})
    if not passed: raise RuntimeError('Acceptance assertion failed')
def claims(token):
    part=token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part+'='*((-len(part))%4)))
def save(path,value):
    descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(descriptor,'w') as stream: json.dump(value,stream,indent=2)

def run():
    if os.geteuid()!=0: raise RuntimeError('Root required')
    if Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip()!='i-REPLACE_INSTANCE_ID': raise RuntimeError('Wrong instance')
    state_file=PRIVATE/'e2e-state.json'
    state=json.loads(state_file.read_text()) if state_file.exists() else {}
    bootstrap=json.loads((PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    pair=api('Admin local login','/api/auth/login',method='POST',body={'email':bootstrap['email'],'password':bootstrap['password']})
    admin=pair['accessToken']
    payload=claims(admin)
    check('Admin JWT role/roles/permissions/provider',payload['role']=='Administrador' and 'Administrador' in payload['roles'] and 'users:manage' in payload['permissions'] and payload['provider']=='local')
    request('Invalid signature rejected','/api/users',401,token=admin[:-len(admin.split('.')[-1])]+('A' if admin.split('.')[-1][0]!='A' else 'B')+admin.split('.')[-1][1:])
    for path in ['/api/users','/api/communities','/api/sensors','/api/alerts','/api/audit/events','/api/reports/history']:
        request('Admin GET '+path,path,token=admin)
    roles=api('Role catalog','/api/roles',token=admin)
    role=next(item for item in roles if item['name']=='Viewer')
    if 'viewer' not in state:
        state['viewer']={'email':'demo.viewer.k3s@climateguard.invalid','password':'Cg7!'+secrets.token_hex(24)}
        save(state_file,state)
    users=api('Find dedicated Viewer','/api/users',token=admin)
    viewer_account=next((u for u in users if u['email']==state['viewer']['email']),None)
    if viewer_account is None:
        viewer_account=api('Create dedicated Viewer','/api/users',201,method='POST',token=admin,
            body={'name':'TEST K3S Viewer','email':state['viewer']['email'],'password':state['viewer']['password'],'roleId':role['id']})
    check('Dedicated account is Viewer',viewer_account['role']=='Viewer')
    viewer_pair=api('Viewer local login','/api/auth/login',method='POST',body=state['viewer'])
    viewer=viewer_pair['accessToken']
    viewer_claims=claims(viewer)
    check('Viewer JWT least privilege',viewer_claims['role']=='Viewer' and 'users:manage' not in viewer_claims['permissions'])
    for path in ['/api/communities','/api/sensors','/api/alerts']:
        request('Viewer read '+path,path,token=viewer)
    for path in ['/api/users','/api/audit/events','/api/reports/history']:
        request('Viewer denied '+path,path,403,token=viewer)
    request('Viewer cannot generate PDF','/api/reports/sensors',403,method='POST',token=viewer,body={})
    communities=api('Community list','/api/communities',token=admin)
    community=next((c for c in communities if c['name']=='TEST K3S comunidad manual'),None)
    if community is None:
        community=api('Create technical community','/api/communities',201,method='POST',token=admin,body={
            'name':'TEST K3S comunidad manual','municipality':'Guatemala','department':'Guatemala','country':'Guatemala',
            'latitude':None,'longitude':None,'description':'PRUEBA TECNICA K3S, sin coordenadas ni datos fisicos inventados.'})
    cid=community['communityId']
    state['communityId']=cid
    sensors=api('Sensor list','/api/sensors',token=admin)
    sensor=next((s for s in sensors if s['name']=='TEST K3S sensor manual'),None)
    if sensor is None:
        sensor=api('Create technical sensor','/api/sensors',201,method='POST',token=admin,
            body={'name':'TEST K3S sensor manual','sensorTypeId':1,'communityId':cid})
    sid=sensor['sensorId']
    state['sensorId']=sid
    rules=api('Rule list','/api/alert-rules',token=admin)
    rule=next((r for r in rules if r['name']=='TEST K3S umbral manual'),None)
    if rule is None:
        rule=api('Create clearly labeled technical rule','/api/alert-rules',201,method='POST',token=admin,body={
            'name':'TEST K3S umbral manual','sensorTypeId':1,'minimumValue':0,'maximumValue':40,
            'alertSeverityId':4,'phenomenonTypeId':2,'message':'PRUEBA TECNICA K3S: lectura manual de validacion, no dato fisico.'})
    state['ruleId']=rule['alertRuleId']
    save(state_file,state)
    request('Viewer cannot write readings',f'/api/sensors/{sid}/readings/manual',403,method='POST',token=viewer,body={'value':45})
    if 'readingId' not in state:
        reading=api('Persist technical manual reading',f'/api/sensors/{sid}/readings/manual',method='POST',token=admin,body={'value':45})
        state['readingId']=reading['sensorReadingId']
        save(state_file,state)
    rid=state['readingId']
    delivered=False
    for attempt in range(6):
        status=api('Reading evaluation status',f'/api/sensors/{sid}/readings/evaluation-status',token=admin)
        delivered=any(row['sensorReadingId']==rid and not row['alertEvaluationPending'] for row in status)
        if delivered: break
        api('Retry persisted evaluation',f'/api/sensors/{sid}/readings/{rid}/evaluate',method='POST',token=admin)
        time.sleep(2)
    check('Reading delivered to Java evaluation',delivered)
    alerts=api('Persisted Java alerts',f'/api/alerts?sensorId={sid}',token=admin)
    check('Technical reading generated an alert',len(alerts)>=1)
    state['alertIds']=[a['alertId'] for a in alerts]
    api('Idempotent repeated evaluation',f'/api/sensors/{sid}/readings/{rid}/evaluate',method='POST',token=admin)
    again=api('Alerts after repeated evaluation',f'/api/alerts?sensorId={sid}',token=admin)
    check('No duplicate alert after retry',len(again)==len(alerts))
    linked=api('Community associations',f'/api/communities/{cid}',token=admin)
    check('Community sensorCount preserved',linked['sensorCount']>=1)
    filters={'sensorId':sid,'communityId':cid,'sensorTypeId':1}
    EVIDENCE.mkdir(mode=0o700,exist_ok=True)
    reports=state.setdefault('reports',{})
    for kind in ['communities','sensors','readings']:
        if kind not in reports:
            body=None if kind=='communities' else dict(filters)
            if kind=='readings':
                now=dt.datetime.now(dt.timezone.utc)
                body.update(startDate=(now-dt.timedelta(hours=2)).isoformat(),endDate=(now+dt.timedelta(minutes=5)).isoformat())
            result=api('Generate '+kind+' PDF','/api/reports/'+kind,method='POST',token=admin,body=body)
            reports[kind]={'id':result['report_id'],'file':result['file_name'],'rows':result.get('row_count')}
            save(state_file,state)
        report=reports[kind]
        raw=request('Download '+kind+' PDF','/api/reports/'+report['id']+'/download',token=admin)
        check('PDF signature '+kind,raw.startswith(b'%PDF-') and len(raw)>1000)
        if kind in ['sensors','readings']: check('Filtered real stored rows '+kind,report['rows']==1)
        report['sha256']=hashlib.sha256(raw).hexdigest()
        report['bytes']=len(raw)
        filename=Path(report['file']).name
        if filename!=report['file'] or not filename.endswith('.pdf'): raise RuntimeError('Unexpected report path')
        (EVIDENCE/filename).write_bytes(raw)
    save(state_file,state)
    history=api('Persistent report history','/api/reports/history',token=admin)
    check('Generated reports present in Mongo history',all(any(row['_id']==r['id'] for row in history['reports']) for r in reports.values()))
    confirmed=0
    for attempt in range(15):
        audit=api('Confirmed report audit','/api/audit/events?module=reports&result=CONFIRMED',token=admin)
        confirmed=audit['total']
        if confirmed>=3: break
        time.sleep(2)
    check('Report generation audited CONFIRMED',confirmed>=3)
    for label,session in [('Admin',pair),('Viewer',viewer_pair)]:
        rotated=api('Rotate refresh '+label,'/api/auth/refresh',method='POST',body={'refreshToken':session['refreshToken']})
        check('Refresh rotated '+label,rotated['refreshToken']!=session['refreshToken'])
        check('Refresh retained provider '+label,claims(rotated['accessToken'])['provider']=='local')
        request('Reject used refresh '+label,'/api/auth/refresh',401,method='POST',body={'refreshToken':session['refreshToken']})
        request('Logout '+label,'/api/auth/logout',method='POST',body={'refreshToken':rotated['refreshToken']})
        request('Reject logged-out refresh '+label,'/api/auth/refresh',401,method='POST',body={'refreshToken':rotated['refreshToken']})
    return {'fixture':'TEST K3S, manual technical data; not physical sensor observations','communityId':cid,'sensorId':sid,'readingId':rid,'alertCount':len(alerts),'reports':reports,'confirmedReportAudit':confirmed}

if __name__=='__main__':
    summary={}
    try: summary=run()
    except Exception as error:
        summary={'failedAt':LAST,'errorType':type(error).__name__}
    result={'atUtc':dt.datetime.now(dt.timezone.utc).isoformat(),'passed':bool(RESULTS) and all(r['passed'] for r in RESULTS) and 'failedAt' not in summary,'checks':RESULTS,'summary':summary,'secretValuesPrinted':False}
    EVIDENCE.mkdir(mode=0o700,exist_ok=True)
    save(EVIDENCE/'business-e2e.json',result)
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)

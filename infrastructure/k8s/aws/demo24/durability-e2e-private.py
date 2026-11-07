"""Controlled restarts of NEW K3s workloads only. PVCs/old Docker data are never removed.
Checks persistent accounts, readings, alerts, audit and exact PDF bytes.
"""
import importlib.util
import json
import subprocess
from pathlib import Path

spec=importlib.util.spec_from_file_location('business',Path(__file__).with_name('business-e2e-private.py'))
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
K=['/usr/local/bin/k3s','kubectl','-n','climateguard']

def command(args):
    result=subprocess.run(K+args,capture_output=True,text=True)
    if result.returncode: raise RuntimeError('Controlled rollout failed; no destructive fallback')
    return result.stdout

def volumes():
    values=json.loads(command(['get','pvc','-o','json']))
    return {x['metadata']['name']:{'uid':x['metadata']['uid'],'volume':x['spec'].get('volumeName'),'phase':x['status']['phase']} for x in values['items']}

def run():
    state=json.loads((b.PRIVATE/'e2e-state.json').read_text())
    initial=volumes()
    credentials=json.loads((b.PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    pair=b.api('Persistence baseline login','/api/auth/login',method='POST',body={'email':credentials['email'],'password':credentials['password']})
    token=pair['accessToken']
    baseline_audit=b.api('Audit before restarts','/api/audit/events',token=token)['total']
    for name in ['sqlserver','alert-db','mongodb','auth-db']:
        print('Controlled restart of NEW StatefulSet: '+name,flush=True)
        command(['rollout','restart','statefulset/'+name])
        command(['rollout','status','statefulset/'+name,'--timeout=240s'])
        command(['wait','--for=condition=Ready','pod/'+name+'-0','--timeout=180s'])
        b.check('New database Ready after restart '+name,True)
        b.check('PVC identities unchanged after '+name,volumes()==initial)
    rotated=b.api('Refresh token persisted across Auth PostgreSQL restart','/api/auth/refresh',method='POST',body={'refreshToken':pair['refreshToken']})
    b.check('Same account after PG restart',rotated['user']['id']==pair['user']['id'])
    token=rotated['accessToken']
    community=b.api('Community survived SQL restart','/api/communities/'+str(state['communityId']),token=token)
    b.check('Association survived SQL restart',community['sensorCount']>=1)
    readings=b.api('Readings survived SQL restart',f"/api/sensors/{state['sensorId']}/readings",token=token)
    b.check('Original reading retained',any(r['sensorReadingId']==state['readingId'] for r in readings))
    alerts=b.api('Alerts survived Alert PostgreSQL restart','/api/alerts?sensorId='+str(state['sensorId']),token=token)
    b.check('Original alert identities retained',set(state['alertIds']).issubset({r['alertId'] for r in alerts}))
    print('Controlled restart of NEW report-service Deployment',flush=True)
    command(['rollout','restart','deployment/report-service'])
    command(['rollout','status','deployment/report-service','--timeout=180s'])
    history=b.api('Report metadata survived Mongo and Report restarts','/api/reports/history',token=token)
    b.check('Original report metadata retained',all(any(x['_id']==r['id'] for x in history['reports']) for r in state['reports'].values()))
    for name,report in state['reports'].items():
        raw=b.request('Persisted PDF after restart '+name,'/api/reports/'+report['id']+'/download',token=token)
        b.check('Exact PDF SHA256 retained '+name,b.hashlib.sha256(raw).hexdigest()==report['sha256'])
    audit=b.api('Audit survived Mongo restart','/api/audit/events',token=token)
    b.check('Existing audit records retained',audit['total']>=baseline_audit)
    created=b.api('Exact CONFIRMED report creation events','/api/audit/events?module=reports&action=create&result=CONFIRMED',token=token)
    b.check('Three report creations confirmed',created['total']>=3)
    b.request('Persistence test logout','/api/auth/logout',method='POST',body={'refreshToken':rotated['refreshToken']})
    return {'newDatabasesRestarted':['sqlserver','alert-db','mongodb','auth-db'],'pdfHashesRetained':True,'pvcIdentitiesRetained':True,'oldDockerDataTouched':False}

if __name__=='__main__':
    summary={}
    try: summary=run()
    except Exception as error: summary={'failedAt':b.LAST,'errorType':type(error).__name__}
    result={'passed':bool(b.RESULTS) and all(r['passed'] for r in b.RESULTS) and 'failedAt' not in summary,'checks':b.RESULTS,'summary':summary,'secretValuesPrinted':False}
    b.save(b.EVIDENCE/'durability-e2e.json',result)
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)

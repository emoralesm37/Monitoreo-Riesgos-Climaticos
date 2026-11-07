"""Controlled audit outage on NEW demo Deployments; preserve all PVC/data.
Only updates the owned TEST community; always restores Audit replicas in finally.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import time

spec=importlib.util.spec_from_file_location('business',Path(__file__).with_name('business-e2e-private.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
K=['k3s','kubectl','-n','climateguard']

def kube(args):
    r=subprocess.run(K+args,capture_output=True,text=True)
    if r.returncode: raise RuntimeError('Kubernetes operation failed; raw output suppressed')
    return r.stdout

def queued():
    output=kube(['exec','deployment/gateway','--','sh','-c',
        'find /var/lib/climateguard/audit-outbox -maxdepth 1 -type f'])
    return [line for line in output.splitlines() if line.endswith(('.ready','.pending'))]

def run():
    private=json.loads((b.PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    session=b.api('Technical Admin login','/api/auth/login',method='POST',body={'email':private['email'],'password':private['password']})
    token=session['accessToken']
    state=json.loads((b.PRIVATE/'e2e-state.json').read_text());cid=state['communityId']
    community=b.api('Owned technical fixture','/api/communities/'+str(cid),token=token)
    b.check('Only owned TEST fixture changed',community['name']=='TEST K3S comunidad manual')
    deployment=json.loads(kube(['get','deployment/audit-service','-o','json']))
    original=deployment['spec']['replicas']
    b.check('Audit initially available',original==1 and deployment['status'].get('readyReplicas')==1)
    query='/api/audit/events?module=communities&action=update&result=CONFIRMED'
    before=b.api('Prior audit events',query,token=token)
    before_ids={x['event_id'] for x in before['items']}
    queued_count=0
    try:
        kube(['scale','deployment/audit-service','--replicas=0'])
        for _ in range(45):
            pods=json.loads(kube(['get','pods','-l','app.kubernetes.io/name=audit-service','-o','json']))['items']
            if not pods: break
            time.sleep(1)
        b.check('Audit Pod stopped for controlled outage',not pods)
        body={key:community.get(key) for key in ['name','municipality','department','country','latitude','longitude','description']}
        # Idempotent update of existing values still traverses the real audit middleware.
        b.request('Write succeeds while audit offline','/api/communities/'+str(cid),204,method='PUT',body=body,token=token)
        queued_count=len(queued())
        b.check('Durable outbox retained pending operation',queued_count>=1)
        kube(['rollout','restart','deployment/gateway'])
        kube(['rollout','status','deployment/gateway','--timeout=180s'])
        b.check('Outbox survives Gateway Pod replacement',len(queued())>=1)
    finally:
        kube(['scale','deployment/audit-service','--replicas='+str(original)])
        kube(['rollout','status','deployment/audit-service','--timeout=180s'])
    confirmed=[]
    for _ in range(30):
        result=b.api('Recovered confirmed audit',query,token=token)
        confirmed=[x for x in result['items'] if x['event_id'] not in before_ids and str(x.get('entity_id'))==str(cid)]
        if confirmed and not queued():break
        time.sleep(2)
    b.check('Exactly one confirmed event after recovery',len(confirmed)==1)
    b.check('Outbox drained after recovery',not queued())
    b.request('Revoke technical test session','/api/auth/logout',method='POST',body={'refreshToken':session['refreshToken']})
    return {'outage':'NEW audit Deployment only; restored in finally','gatewayRestarted':True,'queuedDuringOutage':queued_count,'confirmedRecoveredEvents':len(confirmed),'existingDataDeleted':False}

if __name__=='__main__':
    try:
        summary=run();passed=True
    except Exception as error:
        summary={'failedAt':b.LAST,'errorType':type(error).__name__};passed=False
    result={'passed':passed,'checks':b.RESULTS,'summary':summary,'secretValuesPrinted':False}
    b.save(b.EVIDENCE/'outbox-acceptance.json',result)
    print(json.dumps(result))
    raise SystemExit(0 if passed else 1)

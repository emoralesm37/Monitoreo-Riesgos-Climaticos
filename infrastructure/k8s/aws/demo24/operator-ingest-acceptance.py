"""Dedicated synthetic Operador, real HTTPS; no credential output or hardware."""
import importlib.util,json,secrets,uuid,datetime as dt
from pathlib import Path
spec=importlib.util.spec_from_file_location('m',Path(__file__).with_name('closure-e2e-private.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def run():
    b=m.b;path=b.PRIVATE/'operator-ingest-test.json'
    if not path.exists():
        b.save(path,{'email':'test.uno.'+uuid.uuid4().hex[:10]+'@climateguard.invalid','password':'Cg7!'+secrets.token_hex(24),'deviceId':'TEST_K3S_OP_'+uuid.uuid4().hex[:12]})
    state=json.loads(path.read_text());admin=json.loads((b.PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    pair=m.hit('Admin login','/api/auth/login','POST',{'email':admin['email'],'password':admin['password']});token=pair['accessToken']
    roles=m.hit('Operator role catalog','/api/roles',token=token);role=next(r for r in roles if r['name']=='Operador')
    users=m.hit('Existing technical users','/api/users',token=token)
    if not any(u['email']==state['email'] for u in users):m.hit('Create dedicated TEST Operador','/api/users','POST',{'name':'TEST K3S UNO Operador','email':state['email'],'password':state['password'],'roleId':role['id']},token,(201,))
    op=m.hit('Operador login','/api/auth/login','POST',{'email':state['email'],'password':state['password']});ot=op['accessToken']
    sid=json.loads((b.EVIDENCE/'closure-e2e.json').read_text())['summary']['sensorId']
    binding={'deviceId':state['deviceId'],'ownerUserId':b.claims(ot)['sub']}
    m.hit('Operador cannot self-register device',f'/api/sensors/{sid}/devices','POST',binding,ot,(403,))
    m.hit('Admin binds device to Operador',f'/api/sensors/{sid}/devices','POST',binding,token,(200,201))
    sensor=m.hit('Owned sensor unit',f'/api/sensors/{sid}',token=ot)
    if 'measurement' not in state:
        state['measurement']={'deviceId':state['deviceId'],'measurementId':'TEST_OP_'+uuid.uuid4().hex,'value':48,'unit':sensor['unit'],'capturedAt':dt.datetime.now(dt.timezone.utc).isoformat()};b.save(path,state)
    body=state['measurement'];route=f'/api/sensors/{sid}/readings/ingest'
    m.hit('Other Admin cannot impersonate device owner',route,'POST',body,token,(403,))
    first=m.hit('Bound Operador ingests',route,'POST',body,ot,(200,201))
    again=m.hit('Bound Operador deduplicates',route,'POST',body,ot)
    m.check('Operator receipt identity retained',again['duplicate'] and first['sensorReadingId']==again['sensorReadingId'])
    m.check('Operator rule evaluation delivered',not again['alertEvaluationPending'])
    m.hit('Operator logout','/api/auth/logout','POST',{'refreshToken':op['refreshToken']})
    m.hit('Admin logout','/api/auth/logout','POST',{'refreshToken':pair['refreshToken']})
    return {'sensorId':sid,'readingId':first['sensorReadingId'],'hardwareConnected':False,'provenance':'TEST simulated protocol'}
if __name__=='__main__':
    try:summary=run();passed=True
    except Exception as e:summary={'failedAt':m.LAST,'errorType':type(e).__name__};passed=False
    result={'passed':passed,'checks':m.RESULTS,'summary':summary,'secretValuesPrinted':False}
    m.b.save(m.b.EVIDENCE/'operator-ingest-acceptance.json',result);print(json.dumps(result));raise SystemExit(0 if passed else 1)

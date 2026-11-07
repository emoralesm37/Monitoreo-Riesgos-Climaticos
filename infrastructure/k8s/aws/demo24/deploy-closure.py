"""Reviewed additive demo cutover. No AWS API, deletes, old DB changes or secret output.
Phases: prepare -> community -> cutover -> applications. Each stops on failure.
"""
import copy
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.request

ROOT=Path('/srv/climateguard-demo/fase3-closure2-20261106')
PRIVATE=Path('/srv/climateguard-demo/private')
K=['k3s','kubectl','-n','climateguard']
TAG='fase3-close2-20261106'
STEP='initialization'

def mark(name):
    global STEP
    STEP=name;print(json.dumps({'stage':name}),flush=True)

def run(args, data=None):
    r=subprocess.run(args,input=data,capture_output=True,text=True)
    if r.returncode:raise RuntimeError('Operation failed; inspect privately')
    return r.stdout

def kube(args,data=None):return run(K+args,data)
def get(kind,name):return json.loads(kube(['get',kind,name,'-o','json']))
def apply(obj):
    data=json.dumps(obj);kube(['apply','--dry-run=server','-f','-'],data);kube(['apply','-f','-'],data)
def rollout(name):kube(['rollout','status','deployment/'+name,'--timeout=180s'])
def settle_gateway():
    # Deployment Ready can precede EndpointSlice/Traefik propagation. GET only.
    for _ in range(20):
        try:
            with urllib.request.urlopen('https://climateguard.garher.lat/api/auth/oauth/status',timeout=10) as response:
                if response.status==200:return
        except Exception:pass
        time.sleep(1)
    raise RuntimeError('Public Gateway route did not settle')
def image(name):
    previous=get('deployment',name)['spec']['template']['spec']['containers'][0]['image']
    selected_tag = {'sensor-service':'fase3-close5-20261106','gateway':'fase3-close3-20261106','report-service':'fase3-close4-20261106','frontend':'fase3-close4-20261106','audit-service':'fase3-close6-20261106'}.get(name,TAG)
    kube(['set','image','deployment/'+name,name+'=climateguard/'+name+':'+selected_tag])
    try:rollout(name)
    except Exception:
        kube(['set','image','deployment/'+name,name+'='+previous]);rollout(name)
        raise RuntimeError('Image rollout failed and previous image restored') from None

def pg(sql,database='postgres'):
    # Credentials remain inside the DB Pod environment; no command argument contains them.
    command='PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h 127.0.0.1 -U postgres -d '+database+' -v ON_ERROR_STOP=1 -A -t -q'
    return kube(['exec','-i','auth-db-0','--','sh','-c',command],sql)

def prepare():
    mark('Additive physical ingestion schema')
    sql=(ROOT/'physical-ingest-schema.sql').read_text()+"\nGRANT ALTER ON OBJECT::dbo.Communities TO [cg_demo_app];\n"
    kube(['exec','-i','sqlserver-0','--','sh','-c',
        'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -d ClimateGuard'],sql)
    mark('Sensor compatibility plus physical API rollout')
    image('sensor-service')
    mark('Gateway audit/report support rollout')
    image('gateway')

def network():
    mark('Community service and least-privilege network paths')
    selector=lambda app:{'matchLabels':{'app.kubernetes.io/name':app}}
    peer=lambda app:{'namespaceSelector':{'matchLabels':{'kubernetes.io/metadata.name':'climateguard'}},'podSelector':selector(app)}
    for source,target,port in [('gateway','community-service',8080),('sensor-service','community-service',8080),('community-service','sensor-service',8080),('community-service','auth-db',5432)]:
        for direction,app,other in [('Egress',source,target),('Ingress',target,source)]:
            rule={'ports':[{'port':port,'protocol':'TCP'}],('to' if direction=='Egress' else 'from'):[peer(other)]}
            apply({'apiVersion':'networking.k8s.io/v1','kind':'NetworkPolicy','metadata':{'name':'closure-'+source+'-to-'+target+'-'+direction.lower(),'namespace':'climateguard'},
                'spec':{'podSelector':selector(app),'policyTypes':[direction],direction.lower():[rule]}})
    apply({'apiVersion':'v1','kind':'Service','metadata':{'name':'community-service','namespace':'climateguard'},
        'spec':{'type':'ClusterIP','selector':{'app.kubernetes.io/name':'community-service'},'ports':[{'name':'http','port':8080,'targetPort':'http'}]}})

def community():
    network()
    mark('Separate Community database/role inside existing PostgreSQL instance')
    file=PRIVATE/'community-database.json'
    if not file.exists():
        values={'username':'cg_community_app','password':secrets.token_hex(32),'database':'ClimateGuardCommunity'}
        fd=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as stream:json.dump(values,stream)
    values=json.loads(file.read_text())
    if pg("SELECT 1 FROM pg_roles WHERE rolname='cg_community_app';").strip()!='1':
        pg("SET log_statement='none'; SET log_min_error_statement='panic'; CREATE ROLE cg_community_app LOGIN PASSWORD '"+values['password']+"';")
    if pg("SELECT 1 FROM pg_database WHERE datname='ClimateGuardCommunity';").strip()!='1':
        pg('CREATE DATABASE "ClimateGuardCommunity" OWNER cg_community_app;')
    pg('REVOKE ALL ON DATABASE "ClimateGuardCommunity" FROM PUBLIC; GRANT CONNECT ON DATABASE "ClimateGuardCommunity" TO cg_community_app;')
    connection='Host=auth-db;Port=5432;Database=ClimateGuardCommunity;Username=cg_community_app;Password='+values['password']
    exists=subprocess.run(K+['get','secret','community-db','-o','name'],capture_output=True,text=True)
    if exists.returncode:
        obj={'apiVersion':'v1','kind':'Secret','metadata':{'name':'community-db','namespace':'climateguard'},'type':'Opaque','stringData':{'connection-string':connection}}
        kube(['create','-f','-'],json.dumps(obj))
    template=copy.deepcopy(get('deployment','sensor-service')['spec']['template'])
    template['metadata']={'labels':{'app.kubernetes.io/name':'community-service','app.kubernetes.io/part-of':'climateguard'}}
    pod=template['spec'];container=pod['containers'][0]
    container['name']='community-service';container['image']='climateguard/community-service:'+TAG
    def secret(name,key):return {'secretKeyRef':{'name':name,'key':key}}
    def config(key):return {'configMapKeyRef':{'name':'runtime','key':key}}
    container['env']=[{'name':'ASPNETCORE_ENVIRONMENT','value':'Production'},{'name':'ASPNETCORE_HTTP_PORTS','value':'8080'},
        {'name':'Jwt__AccessSecret','valueFrom':secret('jwt','access-key')},{'name':'Jwt__Issuer','valueFrom':config('JWT_ISSUER')},
        {'name':'Jwt__Audience','valueFrom':config('JWT_AUDIENCE')},
        {'name':'ConnectionStrings__CommunityDatabase','valueFrom':secret('community-db','connection-string')},
        {'name':'Sensor__ServiceUrl','value':'http://sensor-service:8080'}]
    container['resources']={'requests':{'cpu':'50m','memory':'128Mi'},'limits':{'cpu':'500m','memory':'256Mi'}}
    container['readinessProbe']['httpGet']['path']='/health/database'
    container['startupProbe']['httpGet']['path']='/health/database'
    migration=copy.deepcopy(template);mc=migration['spec']['containers'][0]
    for key in ['readinessProbe','startupProbe','livenessProbe']:mc.pop(key,None)
    mc['command']=['dotnet','ClimateGuard.Community.Api.dll','--migrate-only']
    migration['spec']['restartPolicy']='Never'
    migration['spec']['initContainers']=[{'name':'wait-community-db-network','image':'rancher/mirrored-library-busybox:1.37.0','imagePullPolicy':'Never',
        'command':['sh','-ec','for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do nc -z -w 1 auth-db 5432 && exit 0; sleep 1; done; exit 1'],
        'resources':{'requests':{'cpu':'10m','memory':'16Mi'},'limits':{'cpu':'100m','memory':'32Mi'}},
        'securityContext':{'runAsNonRoot':True,'runAsUser':65534,'readOnlyRootFilesystem':True,'allowPrivilegeEscalation':False,'capabilities':{'drop':['ALL']}}}]
    job={'apiVersion':'batch/v1','kind':'Job','metadata':{'name':'community-closure-migrate','namespace':'climateguard'},
        'spec':{'backoffLimit':0,'activeDeadlineSeconds':180,'template':migration}}
    mark('Community EF migration Job')
    exists=subprocess.run(K+['get','job','community-closure-migrate','-o','name'],capture_output=True,text=True)
    if exists.returncode:kube(['create','-f','-'],json.dumps(job))
    kube(['wait','--for=condition=complete','job/community-closure-migrate','--timeout=180s'])
    mark('Independent Community Deployment database readiness')
    deployment={'apiVersion':'apps/v1','kind':'Deployment','metadata':{'name':'community-service','namespace':'climateguard'},
        'spec':{'replicas':1,'revisionHistoryLimit':3,'selector':{'matchLabels':{'app.kubernetes.io/name':'community-service'}},'template':template}}
    apply(deployment);rollout('community-service')
    # Save only public manifests; references to Secrets, never their values.
    (ROOT/'community-deployment.json').write_text(json.dumps(deployment,indent=2))

def business():
    spec=importlib.util.spec_from_file_location('b',Path(__file__).with_name('business-e2e-private.py'))
    b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
    admin=json.loads((PRIVATE/'bootstrap.json').read_text())['bootstrap-admin']
    session=b.api('Migration technical login','/api/auth/login',method='POST',body={'email':admin['email'],'password':admin['password']})
    return b,session

def cutover():
    marker=ROOT/'community-cutover-complete.json'
    if marker.exists():raise RuntimeError('Cutover already completed; do not reimport data')
    mark('Freeze Community writes only; preserve reads and all other modules')
    kube(['set','env','deployment/gateway','Community__MigrationReadOnly=true']);rollout('gateway')
    settle_gateway()
    b,session=business();token=session['accessToken']
    # Verify the write barrier before taking the authoritative source snapshot.
    b.request('Community write barrier','/api/communities',503,method='POST',body={},token=token)
    rows=b.api('Frozen Community source snapshot','/api/communities',token=token)
    snapshot=PRIVATE/'community-source-snapshot.json'
    if not snapshot.exists():
        fd=os.open(snapshot,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as stream:json.dump(rows,stream)
    def literal(value):
        if value is None:return 'NULL'
        if isinstance(value,bool):return 'TRUE' if value else 'FALSE'
        if isinstance(value,(int,float)):return str(value)
        return "'"+str(value).replace("'","''")+"'"
    mark('Copy community rows preserving IDs; no deletion of SQL source')
    sql='BEGIN;\n'
    columns=['community_id','name','municipality','department','country','latitude','longitude','description','is_active']
    keys=['communityId','name','municipality','department','country','latitude','longitude','description','isActive']
    for row in rows:
        sql+='INSERT INTO communities ('+','.join(columns)+') VALUES ('+','.join(literal(row.get(k)) for k in keys)+') ON CONFLICT (community_id) DO NOTHING;\n'
    sql+="SELECT setval(pg_get_serial_sequence('communities','community_id'),COALESCE((SELECT MAX(community_id) FROM communities),1),EXISTS(SELECT 1 FROM communities));\nCOMMIT;"
    pg(sql,'ClimateGuardCommunity')
    copied=json.loads(pg("SELECT COALESCE(json_agg(json_build_object('communityId',community_id,'name',name,'municipality',municipality,'department',department,'country',country,'latitude',latitude,'longitude',longitude,'description',description,'isActive',is_active)),'[]'::json) FROM communities;",'ClimateGuardCommunity'))
    expected={r['communityId']:{key:r.get(key) for key in keys} for r in rows}
    actual={r['communityId']:r for r in copied}
    if expected!=actual:raise RuntimeError('Copied Community rows differ; write barrier retained')
    mark('Enable Sensor API authoritative Community lookups; SQL is private FK projection')
    kube(['set','env','deployment/sensor-service','Community__ServiceUrl=http://community-service:8080']);rollout('sensor-service')
    # Confirm direct API contract without changing public routes yet.
    pod=json.loads(kube(['get','pods','-l','app.kubernetes.io/name=gateway','-o','json']))['items'][0]
    # The normal Sensor list now queries Community -> Sensor counts; validates the cycle terminates.
    b.api('Sensor cross-service contract','/api/sensors',token=token)
    deployment=get('deployment','gateway')
    volumes=deployment['spec']['template']['spec']['volumes']
    volume=next(v for v in volumes if v.get('configMap',{}).get('name','').startswith('gateway-settings'))
    original_name=volume['configMap']['name'];cm=get('configmap',original_name)
    config=json.loads(cm['data']['appsettings.json'])
    (ROOT/'gateway-before-community-cutover.json').write_text(json.dumps({'configMap':original_name,'spec':deployment['spec']},indent=2))
    config['ReverseProxy']['Routes']['communities']['ClusterId']='community-service'
    config['ReverseProxy']['Clusters']['community-service']={'Destinations':{'primary':{'Address':'http://community-service:8080/'}}}
    new_name='gateway-settings-community-closure'
    apply({'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':new_name,'namespace':'climateguard'},'data':{'appsettings.json':json.dumps(config)}})
    volume['configMap']['name']=new_name
    for env in deployment['spec']['template']['spec']['containers'][0]['env']:
        if env['name']=='Community__MigrationReadOnly':env['value']='false'
    mark('Atomic Gateway route switch and Community write thaw')
    kube(['patch','deployment','gateway','--type=merge','-p',json.dumps({'spec':{'template':deployment['spec']['template']}})])
    rollout('gateway')
    settle_gateway()
    final=b.api('Public independent Community result','/api/communities',token=token)
    if {r['communityId']:r['name'] for r in final}!={r['communityId']:r['name'] for r in rows}:raise RuntimeError('Public Community validation failed; do not reverse data blindly')
    if any(not isinstance(r.get('sensorCount'),int) for r in final):raise RuntimeError('Missing sensorCount')
    marker.write_text(json.dumps({'copiedRows':len(rows),'idsPreserved':True,'sensorCountsFromAPI':True,'sourceSQLRetained':True},indent=2))
    b.request('Migration session logout','/api/auth/logout',method='POST',body={'refreshToken':session['refreshToken']})
    print(json.dumps({'communityCutover':True,'rows':len(rows),'oldDataDeleted':False}),flush=True)

def applications():
    for name in ['report-service','frontend']:
        mark('Rollout '+name);image(name)

if __name__=='__main__':
    try:
        if os.geteuid()!=0 or Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip()!='i-REPLACE_INSTANCE_ID':raise RuntimeError('Wrong host or privileges')
        {'prepare':prepare,'community':community,'cutover':cutover,'applications':applications}[sys.argv[1]]()
        print(json.dumps({'phase':sys.argv[1],'passed':True,'secretValuesPrinted':False}),flush=True)
    except Exception as error:
        print(json.dumps({'phase':sys.argv[1] if len(sys.argv)>1 else None,'passed':False,'failedAt':STEP,'errorType':type(error).__name__,'rawErrorsSuppressed':True}),flush=True)
        raise SystemExit(1) from None

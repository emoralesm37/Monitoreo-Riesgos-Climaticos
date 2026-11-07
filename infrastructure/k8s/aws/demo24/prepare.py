"""Offline 24-hour demo sizing. Creates NEW files; never changes bound PVCs.

Consumes the validated AWS candidate and retains all compatibility/OAuth routes.
"""
import argparse
import json
from pathlib import Path
import sys
import yaml

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from validate import official_schema, validate


def prepare(output,swagger):
    if output.exists():
        raise ValueError('New output directory required; do not overwrite another deployment plan')
    source=ROOT/'aws/candidate'
    output.mkdir(parents=True)
    lock=json.loads((source/'release-lock.json').read_text(encoding='utf-8'))
    sizes={'auth-db':'2Gi','alert-db':'2Gi','mongodb':'4Gi','sqlserver':'8Gi',
        'report-pdfs':'2Gi','gateway-outbox':'1Gi'}
    budgets={
        'frontend':('10m','16Mi','100m','48Mi'),
        'gateway':('40m','96Mi','500m','192Mi'),
        'auth-service':('40m','128Mi','500m','256Mi'),
        'legacy-api':('50m','128Mi','500m','256Mi'),
        'sensor-service':('50m','128Mi','500m','256Mi'),
        'alert-service':('100m','384Mi','750m','512Mi'),
        'report-service':('75m','256Mi','750m','512Mi'),
        'audit-service':('40m','96Mi','500m','192Mi'),
        'auth-db':('50m','128Mi','500m','320Mi'),
        'alert-db':('50m','128Mi','500m','320Mi'),
        'mongodb':('75m','256Mi','500m','512Mi'),
        'sqlserver':('400m','2048Mi','1000m','2304Mi'),
    }
    # Requests are proposed for low-traffic demo only, NOT measured full-stack needs.
    summary={'applied':False,'profile':'24-hour university demo on existing m7i-flex.large',
        'instanceId':'i-REPLACE_INSTANCE_ID','instanceType':'m7i-flex.large','vcpu':2,'memoryGiB':8,
        'persistentGiB':19,
        'newEbsGiBIfRequired':40,'preferExistingFilesystemIfFreeGiBAtLeast':40,
        'storageDecision':'WAIT_FOR_SSH_DISK_MEASUREMENT; no additional EBS approved',
        'frontendReplicas':2,'otherApplicationReplicas':1,
        'requestedMemoryMiB':None,'limitsMemoryMiB':None,'defaultBasePvcGiB':112,
        'capacityStatus':'PROPOSED_NOT_PROVEN; native runtime checks mandatory before full application rollout',
        'domain':'climateguard.garher.lat','tag':lock['tag'],'sourceFingerprint':lock['sourceFingerprint'],'files':[]}
    (output/'release-lock.json').write_text(json.dumps(lock,indent=2),encoding='utf-8')
    for file in source.glob('*.yaml'):
        docs=list(yaml.safe_load_all(file.read_text(encoding='utf-8')))
        for doc in docs:
            kind,name=doc['kind'],doc['metadata']['name']
            if kind=='PersistentVolumeClaim':
                doc['spec']['resources']['requests']['storage']=sizes[name]
            if kind=='StatefulSet':
                for claim in doc['spec'].get('volumeClaimTemplates',[]):
                    claim['spec']['resources']['requests']['storage']=sizes[name]
            if kind=='Deployment' and name=='frontend':
                doc['spec']['replicas']=2
            if kind=='Ingress':
                # This 24h deployment reuses the already valid TLS certificate privately.
                doc['metadata'].setdefault('annotations',{}).pop('cert-manager.io/issuer',None)
            if kind in ['Deployment','StatefulSet']:
                for container in doc['spec']['template']['spec']['containers']:
                    cpu,mem,limit_cpu,limit_mem=budgets[name]
                    container['resources']={'requests':{'cpu':cpu,'memory':mem},'limits':{'cpu':limit_cpu,'memory':limit_mem}}
            if kind=='StatefulSet' and name=='mongodb':
                # Explicit WiredTiger cache cap leaves space for connections/process memory.
                doc['spec']['template']['spec']['containers'][0]['args']=['--wiredTigerCacheSizeGB','0.25']
            if kind=='StatefulSet' and name=='sqlserver':
                doc['spec']['template']['spec']['containers'][0]['securityContext']['capabilities']['add']=['NET_BIND_SERVICE']
        core=[d for d in docs if not d['apiVersion'].startswith(('cert-manager.io/','traefik.io/'))]
        errors=official_schema(core,swagger)
        if errors:
            raise ValueError('; '.join(errors))
        # Go's Kubernetes YAML decoder treats plain Y as boolean; keep SQL EULA a string.
        rendered=yaml.safe_dump_all(docs,sort_keys=False).replace('value: Y\n',"value: 'Y'\n")
        (output/file.name).write_text(rendered,encoding='utf-8')
        summary['files'].append(file.name)
    config=yaml.safe_load((ROOT/'aws/k3s-config.yaml').read_text(encoding='utf-8'))
    config['data-dir']='/srv/climateguard-demo/k3s'
    config['default-local-storage-path']='/srv/climateguard-demo/pv'
    config['kubelet-arg']=['system-reserved=cpu=200m,memory=384Mi',
        'kube-reserved=cpu=200m,memory=768Mi',
        'eviction-hard=memory.available<384Mi,nodefs.available<10%',
        'container-log-max-size=10Mi','container-log-max-files=3']
    # Keep logs bounded during the short demo, in addition to eviction thresholds.
    complete=list(yaml.safe_load_all((output/'complete.yaml').read_text(encoding='utf-8')))
    semantic_errors=validate(complete)
    if semantic_errors:
        raise ValueError('; '.join(semantic_errors))
    summary['resourceBudgets']={}
    for doc in complete:
        if doc['kind'] in ['Deployment','StatefulSet']:
            name=doc['metadata']['name']
            summary['resourceBudgets'][name]={'replicas':doc['spec'].get('replicas',1),'resources':doc['spec']['template']['spec']['containers'][0]['resources']}
    def total(field,resource):
        def number(value):
            return float(value[:-2]) if value.endswith('Mi') else float(value[:-1]) if value.endswith('m') else float(value)*1000
        return sum(number(v['resources'][field][resource])*v['replicas'] for v in summary['resourceBudgets'].values())
    summary['requestedMemoryMiB']=total('requests','memory')
    summary['limitsMemoryMiB']=total('limits','memory')
    summary['requestedCpuMillicores']=total('requests','cpu')
    summary['systemAndKubeReservedMiB']=1152
    summary['reservedCpuMillicores']=400
    (output/'k3s-config.yaml').write_text(yaml.safe_dump(config,sort_keys=False),encoding='utf-8')
    (output/'demo-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--swagger',type=Path,required=True)
    args=parser.parse_args()
    prepare(args.output,args.swagger)

"""Sequential reviewed NEW-database jobs. Stops on failure; never prints app logs."""
import json
from pathlib import Path
import subprocess
import sys
import time

K=['/usr/local/bin/k3s','kubectl','-n','climateguard']
def main():
    directory=Path(sys.argv[1])
    subprocess.run(K+['apply','-f',str(directory/'02-job-config.yaml')],check=True)
    names=['provision-auth-db','provision-alert-db','provision-mongo','sql-empty-schema','provision-sql-app','auth-migrate','auth-bootstrap-admin']
    if len(sys.argv)>2:
        names=names[names.index(sys.argv[2]):]
    for name in names:
        file=directory/('job-'+name+'.yaml')
        definition=json.loads(subprocess.check_output(K+['create','--dry-run=client','-f',str(file),'-o','json'],text=True))
        host,port=('mongodb',27017) if name=='provision-mongo' else ('sqlserver',1433) if name.startswith('sql-') or name=='provision-sql-app' else ('auth-db',5432)
        # Probe the actual DB endpoint before mutation; handles initial CNI policy sync.
        definition['spec']['template']['spec']['initContainers']=[{
            'name':'wait-db-network','image':'rancher/mirrored-library-busybox:1.37.0','imagePullPolicy':'Never',
            'command':['/bin/sh','-ec',f'for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do nc -z -w 1 {host} {port} && exit 0; sleep 1; done; exit 1'],
            'resources':{'requests':{'cpu':'10m','memory':'16Mi'},'limits':{'cpu':'100m','memory':'32Mi'}},
            'securityContext':{'runAsNonRoot':True,'runAsUser':65534,'runAsGroup':65534,
                'readOnlyRootFilesystem':True,'allowPrivilegeEscalation':False,'capabilities':{'drop':['ALL']}}}]
        serialized=json.dumps(definition)
        subprocess.run(K+['create','--dry-run=server','-f','-'],input=serialized,text=True,check=True)
        subprocess.run(K+['create','-f','-'],input=serialized,text=True,check=True)
        started=time.monotonic()
        while time.monotonic()-started<600:
            job=json.loads(subprocess.check_output(K+['get','job',name,'-o','json'],text=True))
            conditions={item['type']:item['status'] for item in job.get('status',{}).get('conditions',[])}
            if conditions.get('Failed')=='True': raise RuntimeError('Migration Job failed: '+name+'; inspect privately')
            if conditions.get('Complete')=='True':
                print(json.dumps({'job':name,'result':'Complete','elapsedSeconds':round(time.monotonic()-started)}),flush=True)
                break
            time.sleep(2)
        else: raise RuntimeError('Job deadline reached: '+name)
    print('Requested reviewed provisioning/migration Jobs completed',flush=True)

if __name__=='__main__': main()

"""Deploy only the four NEW namespace StatefulSets, sequentially; no old DB access."""
import json
import subprocess
import sys

K=['/usr/local/bin/k3s','kubectl','-n','climateguard']
def main():
    source=subprocess.run(K+['create','--dry-run=client','-f',sys.argv[1],'-o','json'],capture_output=True,text=True,check=True)
    # kubectl create -o json emits consecutive JSON documents for a multi-doc file.
    remaining=source.stdout.strip()
    docs=[]
    decoder=json.JSONDecoder()
    while remaining:
        data,end=decoder.raw_decode(remaining)
        docs.extend(data.get('items',[data]))
        remaining=remaining[end:].lstrip()
    if {d['metadata']['name'] for d in docs}!={'auth-db','alert-db','mongodb','sqlserver'}:
        raise RuntimeError('Unexpected database manifest')
    for name in ['auth-db','alert-db','mongodb','sqlserver']:
        doc=next(d for d in docs if d['metadata']['name']==name)
        if doc['kind']!='StatefulSet' or doc['metadata'].get('namespace')!='climateguard':
            raise RuntimeError('Wrong target namespace/kind')
        subprocess.run(K+['apply','-f','-'],input=json.dumps(doc),text=True,check=True)
        subprocess.run(K+['rollout','status','statefulset/'+name,'--timeout=300s'],check=True)
        print('Database server Ready: '+name,flush=True)
    subprocess.run(K+['get','pods,pvc'],check=True)

if __name__=='__main__': main()

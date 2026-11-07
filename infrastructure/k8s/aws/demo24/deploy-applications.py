"""Apply the eight reviewed application Deployments one at a time and verify rollout."""
import json
import subprocess
import sys

K=['/usr/local/bin/k3s','kubectl','-n','climateguard']
def main():
    source=subprocess.check_output(K+['create','--dry-run=client','-f',sys.argv[1],'-o','json'],text=True).strip()
    docs=[]
    decoder=json.JSONDecoder()
    while source:
        value,end=decoder.raw_decode(source)
        docs.extend(value.get('items',[value]))
        source=source[end:].lstrip()
    order=['auth-service','legacy-api','sensor-service','alert-service','audit-service','report-service','gateway','frontend']
    if {d['metadata']['name'] for d in docs}!=set(order): raise RuntimeError('Unexpected application set')
    for name in order:
        doc=next(d for d in docs if d['metadata']['name']==name)
        if doc['kind']!='Deployment' or doc['metadata'].get('namespace')!='climateguard': raise RuntimeError('Wrong application target')
        serialized=json.dumps(doc)
        subprocess.run(K+['apply','--dry-run=server','-f','-'],input=serialized,text=True,check=True)
        subprocess.run(K+['apply','-f','-'],input=serialized,text=True,check=True)
        subprocess.run(K+['rollout','status','deployment/'+name,'--timeout=300s'],check=True)
        print('Application Deployment Ready: '+name,flush=True)
        subprocess.run(['free','-m'],check=True)
    subprocess.run(K+['get','deployments,pods,pvc'],check=True)

if __name__=='__main__': main()

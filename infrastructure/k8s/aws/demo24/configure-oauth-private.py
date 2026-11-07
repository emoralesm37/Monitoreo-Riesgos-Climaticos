"""Operator runs interactively over SSH. Inputs stay hidden; no values in CLI/logs.
No real-account login is automated and no provider credentials are generated/rotated.
"""
import getpass
import json
import os
from pathlib import Path
import subprocess

K=['/usr/local/bin/k3s','kubectl','-n','climateguard']
def main():
    if os.geteuid()!=0: raise RuntimeError('Root required')
    if Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip()!='i-REPLACE_INSTANCE_ID': raise RuntimeError('Wrong EC2')
    file=Path('/srv/climateguard-demo/private/bootstrap.json')
    private=json.loads(file.read_text())
    values=private['oauth-clients'].copy()
    for provider in ['google','github']:
        client=getpass.getpass(provider.upper()+' CLIENT_ID (hidden; blank keeps existing): ').strip()
        if client:
            secret=getpass.getpass(provider.upper()+' CLIENT_SECRET (hidden): ').strip()
            if not secret or client.startswith('REPLACE_') or secret.startswith('REPLACE_'): raise RuntimeError('Actual complete pair required')
            if provider=='github' and ('googleusercontent.com' in client.lower() or client.startswith(('ghp_','github_pat_'))): raise RuntimeError('GitHub OAuth App client required, not Google or personal token')
            values[provider+'-client-id']=client
            values[provider+'-client-secret']=secret
    version=subprocess.run(K+['get','secret/oauth-clients','-o','jsonpath={.metadata.resourceVersion}'],capture_output=True,text=True)
    if version.returncode: raise RuntimeError('Existing demo OAuth Secret required')
    obj={'apiVersion':'v1','kind':'Secret','type':'Opaque','metadata':{'name':'oauth-clients','namespace':'climateguard','resourceVersion':version.stdout.strip()},'stringData':values}
    result=subprocess.run(K+['replace','-f','-'],input=json.dumps(obj),capture_output=True,text=True)
    if result.returncode: raise RuntimeError('Private Secret update failed')
    private['oauth-clients']=values
    descriptor=os.open(str(file)+'.new',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as stream: json.dump(private,stream)
    os.replace(str(file)+'.new',file)
    deployment=subprocess.run(K+['get','deployment/auth-service','-o','name'],capture_output=True,text=True)
    if deployment.returncode==0:
        subprocess.run(K+['rollout','restart','deployment/auth-service'],check=True)
        subprocess.run(K+['rollout','status','deployment/auth-service','--timeout=180s'],check=True)
    print(json.dumps({'providerPairsPresent':{p:bool(values[p+'-client-id'] and values[p+'-client-secret']) for p in ['google','github']},'secretValuesPrinted':False}))

if __name__=='__main__':
    try: main()
    except Exception:
        raise SystemExit('Private OAuth setup stopped; no values printed. Review directly on EC2.') from None

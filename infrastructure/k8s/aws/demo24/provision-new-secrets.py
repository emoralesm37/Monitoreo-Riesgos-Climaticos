"""Only NEW demo credentials, generated on EC2. Never prints values or reads dotenv.

Run as root once, after creating the empty application namespace.
OAuth clients remain explicitly unconfigured until the operator supplies them privately.
"""
import json
import os
from pathlib import Path
import secrets
import subprocess

K=['/usr/local/bin/k3s','kubectl','-n','climateguard']
def kubectl(args, data=None):
    return subprocess.run(K+args,input=data,capture_output=True,text=True)

def main():
    if os.geteuid()!=0: raise RuntimeError('Root required')
    identity=Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip()
    if identity!='i-REPLACE_INSTANCE_ID': raise RuntimeError('Wrong instance')
    existing=kubectl(['get','secrets','-o','name'])
    if existing.returncode or existing.stdout.strip(): raise RuntimeError('Namespace is not empty of Secrets; refusing replacement')
    private=Path('/srv/climateguard-demo/private')
    private.mkdir(mode=0o700,exist_ok=True)
    target=private/'bootstrap.json'
    if target.exists(): raise RuntimeError('Private bootstrap already exists; refusing credential rotation')
    password=lambda: 'Cg7!'+secrets.token_hex(32)
    credentials={
        'jwt':{'access-key':secrets.token_hex(32),'refresh-key':secrets.token_hex(32)},
        'audit-signing':{'key':secrets.token_hex(32)},
        'auth-db-app':{'username':'cg_auth_app','password':password()},
        'alert-db-app':{'username':'cg_alert_app','password':password()},
        'report-db':{'username':'cg_report_app','password':password()},
        'audit-db':{'username':'cg_audit_app','password':password()},
        'auth-db-admin':{'password':password()},
        'alert-db-admin':{'password':password()},
        'mongo-admin':{'username':'cg_demo_root','password':password()},
        'sql-admin':{'password':password()},
        'sql-app-bootstrap':{'username':'cg_demo_app','password':password()},
        'bootstrap-admin':{'name':'Administrador demo','email':'demo.admin@climateguard.invalid','password':password()},
        'oauth-clients':{'session-key':secrets.token_hex(32),'google-client-id':'','google-client-secret':'','github-client-id':'','github-client-secret':''},
    }
    sql=credentials['sql-app-bootstrap']
    credentials['sql-app']={'connection-string':'Server=sqlserver,1433;Database=ClimateGuard;User Id='+sql['username']+';Password='+sql['password']+';Encrypt=True;TrustServerCertificate=True'}
    descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as stream: json.dump(credentials,stream)
    for name,values in credentials.items():
        value={'apiVersion':'v1','kind':'Secret','type':'Opaque',
            'metadata':{'name':name,'namespace':'climateguard'},'stringData':values}
        result=kubectl(['create','-f','-'],json.dumps(value))
        # Kubernetes errors may quote the input. Never print them.
        if result.returncode: raise RuntimeError('Secret creation failed: '+name+'; review privately')
        print('Created new demo Secret: '+name)
    print('Private bootstrap saved on EC2 mode 0600. OAuth provider clients are NOT configured. No credential values printed.')

if __name__=='__main__':
    try: main()
    except Exception:
        raise SystemExit('Private provisioning stopped; do not print input, rotate existing values or overwrite Secrets.') from None

"""Package explicit code/published Linux assets, never dotenv or appsettings.
No Docker daemon required on Windows. Runtime images are reused on EC2.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root=Path(__file__).resolve().parents[4]
published=Path(sys.argv[1]);target=Path(sys.argv[2])
baseline='release-20261106-f0048fcb2ff2';tag='fase3-close2-20261106'
inputs=[]
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    def put(file,name):
        if file.name.startswith('.env') or file.name.lower().startswith('appsettings') or file.suffix in ['.pdb','.pem','.key','.pfx']:
            return
        data=file.read_bytes();archive.writestr(name,data);inputs.append({'file':name,'sha256':hashlib.sha256(data).hexdigest()})
    for kind in ['community','sensor','gateway']:
        image=kind+'-service' if kind!='gateway' else 'gateway'
        for file in (published/kind).rglob('*'):
            if file.is_file():put(file,kind+'/publish/'+file.relative_to(published/kind).as_posix())
        archive.writestr(kind+'/Dockerfile',f'FROM docker.io/climateguard/{image}:{baseline}\nCOPY --chown=1654:1654 publish/ /app/\n')
    for file in (root/'frontend/dist/frontend/browser').rglob('*'):
        if file.is_file():put(file,'frontend/html/'+file.relative_to(root/'frontend/dist/frontend/browser').as_posix())
    archive.writestr('frontend/Dockerfile',f'FROM docker.io/climateguard/frontend:{baseline}\nCOPY --chown=101:101 html/ /usr/share/nginx/html/\n')
    app=root/'services/report-service/app'
    for file in list(app.glob('*.py'))+list((app/'templates').glob('*.html')):
        put(file,'report/app/'+file.relative_to(app).as_posix())
    for file in (root/'services/report-service/tests').glob('*.py'):put(file,'report/tests/'+file.name)
    archive.writestr('report/Dockerfile',f'FROM docker.io/climateguard/report-service:{baseline}\nCOPY --chown=10001:10001 app/ /opt/climateguard/services/report-service/app/\n')
    for file in [Path(__file__).with_name('physical-ingest-schema.sql')]:put(file,file.name)
    archive.writestr('inputs.json',json.dumps({'tag':tag,'inputs':inputs},indent=2))
print(json.dumps({'archive':str(target),'bytes':target.stat().st_size,'files':len(inputs),'secretsIncluded':False}))

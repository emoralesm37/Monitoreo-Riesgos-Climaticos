"""Validate prepared lab files offline; never claim a running cluster."""
import argparse
import json
from pathlib import Path
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from validate import official_schema

parser = argparse.ArgumentParser()
parser.add_argument('--directory', type=Path, required=True)
parser.add_argument('--swagger', type=Path, required=True)
args = parser.parse_args()
documents = []
for name in ['platform.yaml', 'apps.yaml', 'probe.yaml']:
    documents.extend(yaml.safe_load_all((args.directory / name).read_text(encoding='utf-8')))
errors = official_schema(documents, args.swagger)
declared = json.loads((args.directory / 'required-secret-keys.json').read_text(encoding='utf-8'))
for doc in documents:
    name = doc['metadata']['name']
    if doc['kind'] != 'Namespace' and doc['metadata'].get('namespace') != 'climateguard-lab':
        errors.append(name + ': wrong namespace')
    if doc['kind'] in ['Secret', 'StatefulSet', 'PersistentVolumeClaim']:
        errors.append(name + ': not part of the no-database lab')
    if doc['kind'] in ['Deployment', 'Job']:
        pod = doc['spec']['template']['spec']
        if pod.get('automountServiceAccountToken') is not False:
            errors.append(name + ': automatic API credentials forbidden')
        for volume in pod.get('volumes', []):
            if 'hostPath' in volume or 'persistentVolumeClaim' in volume:
                errors.append(name + ': existing storage forbidden')
        for container in pod['containers']:
            if container['imagePullPolicy'] != 'Never':
                errors.append(name + ': use explicitly imported local image')
            for env in container.get('env', []):
                ref = env.get('valueFrom', {}).get('secretKeyRef')
                if ref and ref['key'] not in declared.get(ref['name'], []):
                    errors.append(name + ': undeclared lab Secret reference')
if errors:
    raise SystemExit('\n'.join(errors))
print(json.dumps({'offlineOnly': True, 'resourcesPrepared': len(documents), 'schema': 'PASS',
                  'namespaceAndStorageIsolation': 'PASS', 'secretValuesRead': 0, 'resourcesDeployed': 0}))

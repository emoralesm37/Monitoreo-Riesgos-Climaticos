"""Render locally with kubectl's embedded Kustomize. NEVER reads kubeconfig or applies."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import yaml

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--oauth', action='store_true', help='Include optional OAuth clients and HTTPS egress; requires registered providers')
parser.add_argument('--profile', choices=['single-node', 'scalable', 'community-review', 'jobs'], default='single-node')
parser.add_argument('--domain', required=True)
parser.add_argument('--ingress-class', default='traefik')
parser.add_argument('--controller', choices=['traefik', 'nginx'], default='traefik')
parser.add_argument('--ingress-namespace', default='kube-system')
parser.add_argument('--ingress-label', action='append', help='Allowed controller pod label key=value; repeat for multiple labels')
parser.add_argument('--tls-secret', default='climateguard-tls')
parser.add_argument('--storage-class', default='local-path')
parser.add_argument('--image-prefix', default='climateguard')
parser.add_argument('--image-pull-secret', help='Name of an already provisioned private registry Secret')
parser.add_argument('--tag', default='candidate')
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', args.domain) or '.' not in args.domain:
    parser.error('Supply a DNS hostname, without protocol, path or credentials.')
for value in [args.ingress_class, args.ingress_namespace, args.tls_secret, args.storage_class]:
    if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*', value):
        parser.error('Invalid Kubernetes identifier')
with tempfile.TemporaryDirectory(prefix='cg-k8s-render-') as directory:
    root = Path(directory) / 'k8s'
    shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns('.private', '.rendered', '__pycache__', 'bin', 'obj'))
    gateway = root / 'base/config/gateway.json'
    config = json.loads(gateway.read_text(encoding='utf-8'))
    config['Cors']['AllowedOrigins'] = ['https://' + args.domain]
    gateway.write_text(json.dumps(config, indent=2), encoding='utf-8')
    ingress = root / 'base/ingress.yaml'
    data = yaml.safe_load(ingress.read_text(encoding='utf-8'))
    data['spec']['ingressClassName'] = args.ingress_class
    data['spec']['tls'] = [{'hosts': [args.domain], 'secretName': args.tls_secret}]
    data['spec']['rules'][0]['host'] = args.domain
    data['metadata']['annotations'] = ({'traefik.ingress.kubernetes.io/router.entrypoints': 'websecure', 'traefik.ingress.kubernetes.io/router.tls': 'true'}
        if args.controller == 'traefik' else {'nginx.ingress.kubernetes.io/ssl-redirect': 'true'})
    ingress.write_text(yaml.safe_dump(data, sort_keys=False), encoding='utf-8')
    controller_labels = dict(item.split('=', 1) for item in (args.ingress_label or ['app.kubernetes.io/name=traefik']))
    policies = root / 'base/network-policies.yaml'
    documents = list(yaml.safe_load_all(policies.read_text(encoding='utf-8')))
    for doc in documents:
        if doc['metadata']['name'].endswith('-from-ingress'):
            source = doc['spec']['ingress'][0]['from'][0]
            source['namespaceSelector']['matchLabels'] = {'kubernetes.io/metadata.name': args.ingress_namespace}
            source['podSelector']['matchLabels'] = controller_labels
    policies.write_text(yaml.safe_dump_all(documents, sort_keys=False), encoding='utf-8')
    for filename in ['base/storage.yaml', 'overlays/single-node/databases.yaml', 'components/community-independent/resources.yaml']:
        file = root / filename
        documents = list(yaml.safe_load_all(file.read_text(encoding='utf-8')))
        for doc in documents:
            if doc['kind'] == 'PersistentVolumeClaim': doc['spec']['storageClassName'] = args.storage_class
            for claim in doc.get('spec', {}).get('volumeClaimTemplates', []): claim['spec']['storageClassName'] = args.storage_class
        file.write_text(yaml.safe_dump_all(documents, sort_keys=False), encoding='utf-8')
    overlay = root / ('jobs' if args.profile == 'jobs' else 'overlays/' + args.profile) / 'kustomization.yaml'
    data = yaml.safe_load(overlay.read_text(encoding='utf-8'))
    if args.oauth:
        if args.profile == 'jobs': parser.error('OAuth is an application component, not a migration job')
        data.setdefault('components', []).append('../../components/oauth')
        oauth_file = root / 'components/oauth/config.yaml'
        oauth = yaml.safe_load(oauth_file.read_text(encoding='utf-8'))
        oauth['data'] = {'OAUTH_FRONTEND_URL': 'https://' + args.domain,
                         'GOOGLE_CALLBACK_URL': 'https://' + args.domain + '/api/auth/callback/google',
                         'GITHUB_CALLBACK_URL': 'https://' + args.domain + '/api/auth/callback/github'}
        oauth_file.write_text(yaml.safe_dump(oauth, sort_keys=False), encoding='utf-8')
    data['images'] = [{'name': 'climateguard/' + name, 'newName': args.image_prefix.rstrip('/') + '/' + name, 'newTag': args.tag}
                      for name in ['frontend','gateway','auth-service','legacy-api','sensor-service','alert-service','report-service','audit-service','community-service']]
    overlay.write_text(yaml.safe_dump(data, sort_keys=False), encoding='utf-8')
    result = subprocess.run(['kubectl', 'kustomize', str(overlay.parent)], check=True, capture_output=True, text=True, encoding='utf-8')
    documents = list(yaml.safe_load_all(result.stdout))
    # A configuration change changes pod template revisions without requiring a blind restart.
    digest = hashlib.sha256(json.dumps([d for d in documents if d['kind'] == 'ConfigMap'], sort_keys=True).encode()).hexdigest()
    for doc in documents:
        if doc['kind'] in ['Deployment', 'StatefulSet']:
            doc['spec']['template']['metadata'].setdefault('annotations', {})['climateguard.io/config-checksum'] = digest
        if args.image_pull_secret and doc['kind'] in ['Deployment','Job']:
            doc['spec']['template']['spec']['imagePullSecrets'] = [{'name': args.image_pull_secret}]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    rendered=yaml.safe_dump_all(documents, sort_keys=False).replace('value: Y\n',"value: 'Y'\n")
    args.output.write_text(rendered, encoding='utf-8')
    print(f'Locally rendered {len(documents)} resources to {args.output}; no cluster contacted.')

"""Offline AWS candidate: reuses existing renderer, emits separate deployment stages.

Never applies, accesses AWS, reads a kubeconfig, credentials or existing data.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from validate import validate, official_schema
from review_current import memory_mib


def prepare(output, lock, swagger):
    release = json.loads(lock.read_text(encoding='utf-8-sig'))
    if len(release.get('images', [])) != 9 or release.get('failure'):
        raise ValueError('All nine local images must build successfully first')
    output.mkdir(parents=True, exist_ok=True)
    for profile, filename, oauth in [('single-node', 'complete.yaml', True), ('jobs', 'jobs.yaml', False)]:
        command = [sys.executable, str(ROOT / 'tools/render.py'), '--profile', profile,
                   '--domain', 'climateguard.garher.lat', '--storage-class', 'cg-retain',
                   '--tag', release['tag'], '--output', str(output / filename)]
        if oauth:
            command.append('--oauth')
        subprocess.run(command, check=True)
    docs = list(yaml.safe_load_all((output / 'complete.yaml').read_text(encoding='utf-8')))
    jobs = list(yaml.safe_load_all((output / 'jobs.yaml').read_text(encoding='utf-8')))
    import copy
    sql_job = copy.deepcopy(next(d for d in jobs if d['kind'] == 'Job' and d['metadata']['name'] == 'sql-empty-schema'))
    sql_job['metadata']['name'] = 'provision-sql-app'
    sql_container = sql_job['spec']['template']['spec']['containers'][0]
    sql_container['name'] = 'provision-sql-app'
    sql_container['command'] = ['bash', '/bootstrap/provision-sql-app.sh']
    for variable, key in [('CG_SQL_APP_USER', 'username'), ('CG_SQL_APP_PASSWORD', 'password')]:
        sql_container['env'].append({'name': variable, 'valueFrom': {'secretKeyRef': {'name': 'sql-app-bootstrap', 'key': key}}})
    sql_job['spec']['template']['spec']['volumes'][0]['configMap']['name'] = 'sql-app-bootstrap-scripts'
    jobs += [{'apiVersion': 'v1', 'kind': 'ConfigMap',
        'metadata': {'name': 'sql-app-bootstrap-scripts', 'namespace': 'climateguard'},
        'data': {name: (ROOT / 'aws' / name).read_text(encoding='utf-8') for name in ['provision-sql-app.sh', 'sql-app.sql']}}, sql_job]
    pins = json.loads((ROOT / 'aws/database-images.json').read_text(encoding='utf-8'))
    images = {i['image']: i for i in release['images']}
    for doc in docs + jobs:
        if doc['kind'] in ['Deployment', 'StatefulSet', 'Job']:
            for container in doc['spec']['template']['spec']['containers']:
                image = container['image']
                if image in images:
                    # Import archive into native containerd; no registry publication needed.
                    container['imagePullPolicy'] = 'Never'
                elif image in pins:
                    container['image'] = pins[image]
                else:
                    raise ValueError('Unreviewed runtime image: ' + image)
        if doc['kind'] == 'Ingress':
            doc['metadata']['annotations']['cert-manager.io/issuer'] = 'letsencrypt'
    storage = {'apiVersion': 'storage.k8s.io/v1', 'kind': 'StorageClass',
               'metadata': {'name': 'cg-retain'}, 'provisioner': 'rancher.io/local-path',
               'reclaimPolicy': 'Retain', 'volumeBindingMode': 'WaitForFirstConsumer'}
    # ACME solver is reached only from Traefik; application deny-all remains effective.
    solver_policy = {'apiVersion': 'networking.k8s.io/v1', 'kind': 'NetworkPolicy',
        'metadata': {'name': 'acme-from-traefik', 'namespace': 'climateguard'},
        'spec': {'podSelector': {'matchLabels': {'acme.cert-manager.io/http01-solver': 'true'}},
            'policyTypes': ['Ingress'], 'ingress': [{'from': [{
                'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': 'kube-system'}},
                'podSelector': {'matchLabels': {'app.kubernetes.io/name': 'traefik'}}}],
                'ports': [{'protocol': 'TCP', 'port': 8089}]}]}}
    issuer = {'apiVersion': 'cert-manager.io/v1', 'kind': 'Issuer',
        'metadata': {'name': 'letsencrypt', 'namespace': 'climateguard'},
        'spec': {'acme': {'server': 'https://acme-v02.api.letsencrypt.org/directory',
            'privateKeySecretRef': {'name': 'letsencrypt-account'},
            'solvers': [{'http01': {'ingress': {'ingressClassName': 'traefik'}}}]}}}
    errors = validate(docs) + official_schema(docs, swagger) + official_schema(jobs, swagger)
    if errors:
        raise ValueError('; '.join(errors))
    def write(name, values):
        rendered=yaml.safe_dump_all(values, sort_keys=False).replace('value: Y\n',"value: 'Y'\n")
        (output / name).write_text(rendered, encoding='utf-8')
    probe_label = {'app.kubernetes.io/name': 'release-probe'}
    app_selector = {'matchExpressions': [{'key': 'app.kubernetes.io/name', 'operator': 'In',
        'values': [d['metadata']['name'] for d in docs if d['kind'] == 'Deployment']}]}
    probe_ports = [{'protocol': 'TCP', 'port': p} for p in [8080,7101,7301,8000,8001]]
    probe_code = {'apiVersion': 'v1', 'kind': 'ConfigMap',
        'metadata': {'name': 'release-probe-code', 'namespace': 'climateguard'},
        'data': {'internal-probe.cjs': (ROOT / 'aws/internal-probe.cjs').read_text(encoding='utf-8')}}
    def policy(name, spec):
        return {'apiVersion': 'networking.k8s.io/v1', 'kind': 'NetworkPolicy',
            'metadata': {'name': name, 'namespace': 'climateguard'}, 'spec': spec}
    probe_policies = [policy('release-probe-egress', {'podSelector': {'matchLabels': probe_label},
        'policyTypes': ['Egress'], 'egress': [{'to': [{'podSelector': app_selector}], 'ports': probe_ports}]}),
        policy('applications-from-release-probe', {'podSelector': app_selector, 'policyTypes': ['Ingress'],
            'ingress': [{'from': [{'podSelector': {'matchLabels': probe_label}}], 'ports': probe_ports}]})]
    probe = {'apiVersion': 'batch/v1', 'kind': 'Job',
        'metadata': {'name': 'release-internal-probe', 'namespace': 'climateguard'},
        'spec': {'backoffLimit': 0, 'activeDeadlineSeconds': 180, 'template': {
            'metadata': {'labels': probe_label}, 'spec': {'restartPolicy': 'Never',
                'automountServiceAccountToken': False,
                'securityContext': {'runAsNonRoot': True, 'runAsUser': 1000, 'runAsGroup': 1000,
                    'seccompProfile': {'type': 'RuntimeDefault'}},
                'containers': [{'name': 'probe', 'image': next(i['image'] for i in release['images'] if i['name'] == 'auth-service'),
                    'imagePullPolicy': 'Never', 'command': ['node','/probe/internal-probe.cjs'],
                    'resources': {'requests': {'cpu': '25m', 'memory': '64Mi'}, 'limits': {'cpu': '250m', 'memory': '128Mi'}},
                    'securityContext': {'allowPrivilegeEscalation': False, 'readOnlyRootFilesystem': True,
                        'capabilities': {'drop': ['ALL']}},
                    'volumeMounts': [{'name': 'code', 'mountPath': '/probe', 'readOnly': True}]}],
                'volumes': [{'name': 'code', 'configMap': {'name': 'release-probe-code'}}]}}}}
    extra_errors = official_schema([storage, solver_policy, probe_code, probe, *probe_policies], swagger)
    if extra_errors:
        raise ValueError('; '.join(extra_errors))
    write('complete.yaml', docs)
    write('jobs.yaml', jobs)
    write('00-platform.yaml', [storage] + [d for d in docs if d['kind'] not in ['StatefulSet', 'Deployment', 'Ingress']] + [solver_policy, probe_code] + probe_policies)
    write('01-databases.yaml', [d for d in docs if d['kind'] == 'StatefulSet'])
    write('02-job-config.yaml', [d for d in jobs if d['kind'] != 'Job'])
    for doc in jobs:
        if doc['kind'] == 'Job':
            write('job-' + doc['metadata']['name'] + '.yaml', [doc])
    write('03-applications.yaml', [d for d in docs if d['kind'] == 'Deployment'])
    write('04-issuer.yaml', [issuer])
    write('05-ingress.yaml', [d for d in docs if d['kind'] == 'Ingress'])
    write('06-internal-probe.yaml', [probe])
    redirect = {'apiVersion': 'traefik.io/v1alpha1', 'kind': 'Middleware',
        'metadata': {'name': 'redirect-https', 'namespace': 'climateguard'},
        'spec': {'redirectScheme': {'scheme': 'https', 'permanent': True}}}
    http_ingress = copy.deepcopy(next(d for d in docs if d['kind'] == 'Ingress'))
    http_ingress['metadata']['name'] = 'public-http'
    http_ingress['metadata']['annotations'] = {
        'traefik.ingress.kubernetes.io/router.entrypoints': 'web',
        'traefik.ingress.kubernetes.io/router.middlewares': 'climateguard-redirect-https@kubernetescrd'}
    http_ingress['spec'].pop('tls', None)
    http_errors = official_schema([http_ingress], swagger)
    if http_errors:
        raise ValueError('; '.join(http_errors))
    # HTTP-01 solver has a more-specific path and its own ingress, without middleware.
    write('07-http-redirect.yaml', [redirect, http_ingress])
    workloads = [d for d in docs if d['kind'] in ['StatefulSet', 'Deployment']]
    resources = [c['resources'] for d in workloads for c in d['spec']['template']['spec']['containers']]
    claims = [d for d in docs if d['kind'] == 'PersistentVolumeClaim']
    claim_specs = [d['spec'] for d in claims] + [c['spec'] for d in workloads for c in d['spec'].get('volumeClaimTemplates', [])]
    summary = {'domain': 'climateguard.garher.lat', 'tag': release['tag'],
        'sourceFingerprint': release['sourceFingerprint'], 'applicationImages': release['images'],
        'databaseImages': pins, 'deployments': sum(d['kind'] == 'Deployment' for d in docs),
        'statefulSets': sum(d['kind'] == 'StatefulSet' for d in docs),
        'services': sum(d['kind'] == 'Service' for d in docs), 'migrationJobs': sum(d['kind'] == 'Job' for d in jobs), 'diagnosticJobs': 1,
        'requestedMemoryMiB': sum(memory_mib(r['requests']['memory']) for r in resources),
        'memoryLimitsMiB': sum(memory_mib(r['limits']['memory']) for r in resources),
        'persistentGiB': sum(memory_mib(s['resources']['requests']['storage'])/1024 for s in claim_specs),
        'validation': 'Offline semantics and official core OpenAPI only; cert-manager/Traefik CRDs and admission not tested',
        'deployed': False, 'productionReady': False,
        'blockingGates': ['AWS inventory/access and region', 'approved capacity, maintenance and rollback',
            'execute new SQL identity Job and verify matching connection-string', 'approved catalog initialization', 'OAuth production clients',
            'SQL Server edition/license', 'dependency vulnerability review', 'real full-stack E2E and restore']}
    (output / 'candidate-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k not in ['applicationImages','databaseImages']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--release-lock', type=Path, required=True)
    parser.add_argument('--swagger', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.output, args.release_lock, args.swagger)

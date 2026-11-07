"""Prepare a minimal isolated lab. No cluster, Secret values, network or databases.

Output is separate staged YAML, not an application-complete ClimateGuard stack.
"""
import argparse
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
NS = 'climateguard-lab'


def render(output):
    output.mkdir(parents=True, exist_ok=True)
    deployments = list(yaml.safe_load_all((ROOT / 'base/deployments.yaml').read_text(encoding='utf-8')))
    apps = []
    for source in deployments:
        name = source['metadata']['name']
        if name not in ('frontend', 'gateway'):
            continue
        app = copy.deepcopy(source)
        app['metadata']['namespace'] = NS
        app['spec']['strategy'] = {'type': 'Recreate'}
        pod = app['spec']['template']['spec']
        container = pod['containers'][0]
        container['image'] = f'climateguard/{name}:review-20261106'
        container['imagePullPolicy'] = 'Never'
        container['resources'] = {'requests': {'cpu': '25m' if name == 'frontend' else '100m',
            'memory': '32Mi' if name == 'frontend' else '128Mi'},
            'limits': {'cpu': '250m' if name == 'frontend' else '750m',
                       'memory': '96Mi' if name == 'frontend' else '256Mi'}}
        for volume in pod['volumes']:
            if volume['name'] == 'outbox':
                volume.pop('persistentVolumeClaim', None)
                volume['emptyDir'] = {'sizeLimit': '32Mi'}
        apps.append(app)

    def obj(kind, name, **values):
        return {'apiVersion': 'v1', 'kind': kind, 'metadata': {'name': name, 'namespace': NS}, **values}
    proxy = {'Logging': {'LogLevel': {'Default': 'Warning'}},
        'Audit': {'Enabled': False, 'OutboxDirectory': '/var/lib/climateguard/audit-outbox'},
        'ReverseProxy': {'Clusters': {'frontend-probe': {'Destinations': {'primary': {'Address': 'http://frontend:8080/'}}}},
            'Routes': {
                'probe': {'ClusterId': 'frontend-probe', 'AuthorizationPolicy': 'anonymous',
                    'Match': {'Path': '/probe'}, 'Transforms': [{'PathSet': '/healthz'}]},
                'restricted': {'ClusterId': 'frontend-probe', 'AuthorizationPolicy': 'Administrators',
                    'Match': {'Path': '/restricted'}, 'Transforms': [{'PathSet': '/healthz'}]},
            }}}
    platform = [{'apiVersion': 'v1', 'kind': 'Namespace', 'metadata': {'name': NS,
        'labels': {'climateguard.io/lab': 'isolated-mini'}}},
        obj('ConfigMap', 'runtime', data={'JWT_ISSUER': 'cg-isolated-lab', 'JWT_AUDIENCE': 'cg-isolated-lab'}),
        obj('ConfigMap', 'gateway-settings', data={'appsettings.json': json.dumps(proxy)}),
        obj('ConfigMap', 'frontend-settings', data={'nginx.conf': (ROOT / 'base/config/nginx.conf').read_text(encoding='utf-8')}),
        obj('ConfigMap', 'probe-code', data={'probe.cjs': (ROOT / 'lab-minimal/probe.cjs').read_text(encoding='utf-8')})]
    for name in ['frontend', 'gateway']:
        platform.append(obj('Service', name, spec={'type': 'ClusterIP',
            'selector': {'app.kubernetes.io/name': name, 'app.kubernetes.io/part-of': 'climateguard'},
            'ports': [{'name': 'http', 'port': 8080, 'targetPort': 'http'}]}))
    def policy(name, spec):
        return {'apiVersion': 'networking.k8s.io/v1', 'kind': 'NetworkPolicy',
            'metadata': {'name': name, 'namespace': NS}, 'spec': spec}
    platform += [
        policy('deny-all', {'podSelector': {}, 'policyTypes': ['Ingress', 'Egress']}),
        policy('dns-only', {'podSelector': {}, 'policyTypes': ['Egress'], 'egress': [{'to': [{
            'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': 'kube-system'}},
            'podSelector': {'matchLabels': {'k8s-app': 'kube-dns'}}}],
            'ports': [{'protocol': 'UDP', 'port': 53}, {'protocol': 'TCP', 'port': 53}]}]}),
        policy('internal-http-ingress', {'podSelector': {}, 'policyTypes': ['Ingress'],
            'ingress': [{'from': [{'podSelector': {}}], 'ports': [{'protocol': 'TCP', 'port': 8080}]}]}),
        policy('internal-http-egress', {'podSelector': {}, 'policyTypes': ['Egress'],
            'egress': [{'to': [{'podSelector': {'matchExpressions': [{'key': 'app.kubernetes.io/name',
                'operator': 'In', 'values': ['frontend', 'gateway']}]}}], 'ports': [{'protocol': 'TCP', 'port': 8080}]}]}),
    ]
    probe = {'apiVersion': 'batch/v1', 'kind': 'Job', 'metadata': {'name': 'http-dns-probe', 'namespace': NS},
        'spec': {'backoffLimit': 0, 'activeDeadlineSeconds': 180, 'template': {
            'metadata': {'labels': {'app.kubernetes.io/name': 'http-dns-probe'}},
            'spec': {'restartPolicy': 'Never', 'automountServiceAccountToken': False,
                'securityContext': {'runAsNonRoot': True, 'runAsUser': 1000, 'runAsGroup': 1000,
                    'fsGroup': 1000, 'seccompProfile': {'type': 'RuntimeDefault'}},
                'containers': [{'name': 'probe', 'image': 'climateguard/auth-service:review-20261106',
                    'imagePullPolicy': 'Never', 'command': ['node', '/probe/probe.cjs'],
                    'env': [{'name': 'LAB_ACCESS_KEY', 'valueFrom': {'secretKeyRef': {'name': 'jwt', 'key': 'access-key'}}}],
                    'resources': {'requests': {'cpu': '25m', 'memory': '64Mi'}, 'limits': {'cpu': '250m', 'memory': '128Mi'}},
                    'securityContext': {'readOnlyRootFilesystem': True, 'allowPrivilegeEscalation': False, 'capabilities': {'drop': ['ALL']}},
                    'volumeMounts': [{'name': 'code', 'mountPath': '/probe', 'readOnly': True}, {'name': 'tmp', 'mountPath': '/tmp'}]}],
                'volumes': [{'name': 'code', 'configMap': {'name': 'probe-code'}}, {'name': 'tmp', 'emptyDir': {'sizeLimit': '16Mi'}}]}}}}
    for name, docs in [('platform.yaml', platform), ('apps.yaml', apps), ('probe.yaml', [probe])]:
        (output / name).write_text(yaml.safe_dump_all(docs, sort_keys=False), encoding='utf-8')
    (output / 'required-secret-keys.json').write_text(json.dumps({'jwt': ['access-key'], 'audit-signing': ['key']}, indent=2), encoding='utf-8')
    print(json.dumps({'preparedOnly': True, 'namespace': NS, 'deployments': 2, 'services': 2,
        'jobs': 1, 'secretValues': 0, 'databases': 0, 'persistentVolumes': 0,
        'requestsMiBIncludingProbe': 224, 'limitsMiBIncludingProbe': 480}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    render(parser.parse_args().output)

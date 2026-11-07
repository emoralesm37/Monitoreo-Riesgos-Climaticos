"""Offline semantic + optional official Kubernetes OpenAPI validation. No cluster API."""
import argparse
import json
from pathlib import Path
import re
import sys
import warnings
import yaml
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def validate(documents):
    errors = []
    def check(ok, message):
        if not ok: errors.append(message)
    items = {(d['kind'], d['metadata']['name']): d for d in documents}
    check(len(items) == len(documents), 'Duplicate kind/name')
    declared = json.loads((ROOT / 'secrets/required-keys.json').read_text(encoding='utf-8'))
    services = {name: d for (kind, name), d in items.items() if kind == 'Service'}
    workloads = [d for d in documents if d['kind'] in ['Deployment', 'StatefulSet', 'Job']]
    for doc in documents:
        name, kind = doc['metadata']['name'], doc['kind']
        check(kind != 'Secret', 'Do not render credentials/Secret values into versioned resources')
        if kind != 'Namespace': check(doc['metadata'].get('namespace') == 'climateguard', name + ': namespace missing')
        if kind == 'Service': check(doc['spec'].get('type', 'ClusterIP') == 'ClusterIP', name + ': public NodePort/LoadBalancer forbidden')
    for doc in workloads:
        kind, name = doc['kind'], doc['metadata']['name']
        pod = doc['spec']['template']['spec']
        check(pod.get('automountServiceAccountToken') is False, name + ': service-account token must not be mounted')
        if name in ['gateway','report-service','auth-service']:
            check(doc['spec'].get('replicas') == 1, name + ': must remain single-replica until state/concurrency blockers are solved')
        if name in ['gateway','report-service','auth-service']:
            check(doc['spec']['strategy']['type'] == 'Recreate', name + ': exclusive PVC owner requires Recreate')
        for volume in pod.get('volumes', []):
            if 'configMap' in volume: check(('ConfigMap', volume['configMap']['name']) in items, name + ': missing ConfigMap')
            if 'persistentVolumeClaim' in volume: check(('PersistentVolumeClaim', volume['persistentVolumeClaim']['claimName']) in items, name + ': missing PVC')
        for container in pod['containers']:
            check('resources' in container and all(k in container['resources'] for k in ['requests','limits']), name + ': resource budget missing')
            try:
                def quantity(value, cpu):
                    value = str(value)
                    if cpu: return float(value[:-1]) / 1000 if value.endswith('m') else float(value)
                    match = re.fullmatch(r'([0-9.]+)(Ki|Mi|Gi|Ti)?', value)
                    return float(match[1]) * {'Ki':1024,'Mi':1024**2,'Gi':1024**3,'Ti':1024**4,None:1}[match[2]]
                for resource in ['cpu','memory']:
                    request = quantity(container['resources']['requests'][resource], resource == 'cpu')
                    limit = quantity(container['resources']['limits'][resource], resource == 'cpu')
                    check(0 < request <= limit, name + ': invalid requests/limits for ' + resource)
            except (KeyError, TypeError, ValueError): errors.append(name + ': CPU/memory budget is incomplete or malformed')
            if kind != 'Job':
                check(all(k in container for k in ['startupProbe','readinessProbe','livenessProbe']), name + ': probe missing')
                ports = {p['name'] for p in container.get('ports', [])}
                for probe in ['startupProbe','readinessProbe','livenessProbe']:
                    handler = container.get(probe, {}).get('httpGet', container.get(probe, {}).get('tcpSocket', {}))
                    if isinstance(handler.get('port'), str): check(handler['port'] in ports, name + ': probe named port missing')
            for variable in container.get('env', []):
                value, source = variable.get('value'), variable.get('valueFrom', {})
                check(not (value and re.search(r'PASSWORD|SECRET|^Jwt__Key$|^ConnectionStrings__', variable['name'], re.I)), name + ': sensitive env must use Secret reference: ' + variable['name'])
                if 'secretKeyRef' in source:
                    ref = source['secretKeyRef']; check(ref['key'] in declared.get(ref['name'], []), name + ': undeclared Secret key ' + ref['name'] + '/' + ref['key'])
                if 'configMapKeyRef' in source:
                    ref = source['configMapKeyRef']; cm = items.get(('ConfigMap', ref['name']), {})
                    # Jobs are separately rendered and use the already-reviewed runtime ConfigMap.
                    check(ref['key'] in cm.get('data', {}) or (kind == 'Job' and ref['name'] == 'runtime'), name + ': missing ConfigMap key')
            check(not any(v.get('hostPath') for v in pod.get('volumes', [])), name + ': no hostPath adoption of existing disks')
    for name, service in services.items():
        selector = service['spec']['selector']
        matches = [d for d in workloads if all(d['spec']['template']['metadata'].get('labels', {}).get(k) == v for k, v in selector.items())]
        check(len(matches) == 1, name + ': selector must match exactly one workload')
        if matches:
            ports = matches[0]['spec']['template']['spec']['containers'][0]['ports']
            for port in service['spec']['ports']:
                check(any(p['name'] == port['targetPort'] or p['containerPort'] == port['targetPort'] for p in ports), name + ': targetPort mismatch')
    for doc in documents:
        if doc['kind'] == 'HorizontalPodAutoscaler':
            name = doc['spec']['scaleTargetRef']['name']
            check(name in ['frontend','sensor-service','alert-service','audit-service'], name + ': unsafe HPA target')
            check(('Deployment', name) in items, name + ': HPA target missing')
    maps = [d for d in documents if d['kind'] == 'ConfigMap' and 'appsettings.json' in d.get('data', {})]
    report = items.get(('Deployment', 'report-service'))
    if report:
        variables = {v['name']: v for v in report['spec']['template']['spec']['containers'][0].get('env', [])}
        for name in ['COMMUNITY_SERVICE_URL', 'SENSOR_SERVICE_URL']:
            variable = variables.get(name, {})
            ref = variable.get('valueFrom', {}).get('configMapKeyRef', {})
            value = items.get(('ConfigMap', ref.get('name')), {}).get('data', {}).get(ref.get('key'))
            value = variable.get('value', value)
            check(value == 'http://gateway:8080', 'Report upstream must use internal Gateway: ' + name)
    oauth = items.get(('ConfigMap', 'oauth-settings'))
    if oauth:
        auth = items.get(('Deployment', 'auth-service'), {})
        variables = {v['name']: v for v in auth.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', [])}
        check(variables.get('OAUTH_SESSION_KEY', {}).get('valueFrom', {}).get('secretKeyRef') ==
              {'name':'oauth-clients','key':'session-key'}, 'OAuth session key must use declared Secret')
        origin = oauth['data'].get('OAUTH_FRONTEND_URL', '')
        check(origin.startswith('https://'), 'OAuth requires HTTPS origin')
        check(any(urlsplit(origin).hostname == rule['host'] for d in documents if d['kind'] == 'Ingress'
                  for rule in d['spec']['rules']), 'OAuth origin must match Ingress hostname')
        for provider in ['google', 'github']:
            check(oauth['data'].get(provider.upper() + '_CALLBACK_URL') == origin + '/api/auth/callback/' + provider,
                  'OAuth callback/origin mismatch: ' + provider)
    gateway = next((json.loads(d['data']['appsettings.json']) for d in maps if 'ReverseProxy' in d['data']['appsettings.json']), None)
    if gateway:
        check('Jwt' not in gateway, 'Gateway ConfigMap must not contain JWT signing configuration')
        proxy = gateway['ReverseProxy']
        for key in ['auth','users','roles','communities','sensors','catalogs','rules','alerts','reports','audit']:
            check(key in proxy['Routes'], 'Missing Gateway route ' + key)
        for key in ['users','roles','reports','audit']:
            check(proxy['Routes'].get(key, {}).get('AuthorizationPolicy') == 'Administrators', 'Administrative route is not protected: ' + key)
        check(proxy['Routes']['audit']['Match'].get('Methods') == ['GET'], 'Do not expose event ingestion publicly')
        for cluster in proxy['Clusters'].values():
            for target in cluster['Destinations'].values():
                host = target['Address'].split('//')[-1].split(':')[0]
                check(host in services, 'Missing upstream Service ' + host)
                if host in services: check(any(p['port'] == urlsplit(target['Address']).port for p in services[host]['spec']['ports']), 'Wrong upstream Service port for ' + host)
                check(not any(x in target['Address'] for x in ['localhost','127.0.0.1','host.docker.internal']), 'Host-local upstream is invalid in Kubernetes')
        check(proxy['Routes']['communities']['ClusterId'] == 'legacy-api', 'Independent Community contract is not integrated yet')
    for doc in documents:
        if doc['kind'] == 'Ingress':
            check(bool(doc['spec'].get('tls')), 'TLS reference missing')
            for rule in doc['spec']['rules']:
                for path in rule['http']['paths']:
                    service = path['backend']['service']
                    check(service['name'] in ['frontend','gateway'], 'Do not publish internal services through Ingress')
                    check(service['name'] in services, 'Ingress Service missing')
                if gateway: check('https://' + rule['host'] in gateway['Cors']['AllowedOrigins'], 'CORS/Ingress hostname mismatch')
    return errors


def official_schema(documents, file):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', DeprecationWarning)
        from jsonschema import Draft4Validator, RefResolver
    schema = json.loads(file.read_text(encoding='utf-8'))
    # OpenAPI lists known properties but does not reject unknown ones. Tighten objects.
    def tighten(value):
        if isinstance(value, dict):
            # Kubernetes OpenAPI v2 represents IntOrString with a vendor format.
            if value.get('format') == 'int-or-string' or value.get('x-kubernetes-int-or-string'):
                value['type'] = ['integer', 'string']
            if value.get('type') == 'object' and 'properties' in value:
                value.setdefault('additionalProperties', False)
            for item in list(value.values()): tighten(item)
        elif isinstance(value, list):
            for item in value: tighten(item)
    tighten(schema)
    definitions = schema['definitions']
    errors = []
    for doc in documents:
        group, _, version = doc['apiVersion'].rpartition('/')
        if not version: version = doc['apiVersion']
        definition = next((s for s in definitions.values() if {'group': group, 'version': version, 'kind': doc['kind']} in s.get('x-kubernetes-group-version-kind', [])), None)
        if definition is None: errors.append('No official schema for ' + doc['kind']); continue
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', DeprecationWarning)
            validator = Draft4Validator(definition, resolver=RefResolver.from_schema(schema))
            for error in validator.iter_errors(doc):
                errors.append(doc['metadata']['name'] + ': ' + str(list(error.absolute_path)) + ' ' + error.message)
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file', type=Path)
    parser.add_argument('--swagger', type=Path)
    parser.add_argument('--dependencies', type=Path)
    args = parser.parse_args()
    if args.dependencies: sys.path.insert(0, str(args.dependencies))
    documents = [d for d in yaml.safe_load_all(args.file.read_text(encoding='utf-8-sig')) if d]
    errors = validate(documents)
    if args.swagger: errors += official_schema(documents, args.swagger)
    if errors: print('\n'.join(errors)); raise SystemExit(1)
    print(f'PASS: {len(documents)} resources; references, routes, ports, probes, budgets, storage and HPA checked' + ('; official offline OpenAPI checked.' if args.swagger else '.'))

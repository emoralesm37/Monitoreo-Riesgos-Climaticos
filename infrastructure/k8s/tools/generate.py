"""Generate non-secret manifests from the inspected compatibility architecture.
No network, cluster, Docker or database operations. Run from any directory.
"""
from pathlib import Path
import json
import copy
import yaml

ROOT = Path(__file__).resolve().parents[1]
NS = 'climateguard'


def write(name, docs):
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    rendered=yaml.safe_dump_all(docs, sort_keys=False, allow_unicode=True).replace('value: Y\n',"value: 'Y'\n")
    target.write_text(rendered, encoding='utf-8')


def obj(kind, name, spec=None, api='v1', **extra):
    result = dict(apiVersion=api, kind=kind, metadata={'name': name, 'labels': {'app.kubernetes.io/part-of': NS}})
    if spec is not None:
        result['spec'] = spec
    result.update(extra)
    return result


def labels(name):
    return {'app.kubernetes.io/name': name, 'app.kubernetes.io/part-of': NS}


def env(name, value):
    return {'name': name, 'value': str(value)}


def secret(name, source, key):
    return {'name': name, 'valueFrom': {'secretKeyRef': {'name': source, 'key': key}}}


def cm(name, source, key):
    return {'name': name, 'valueFrom': {'configMapKeyRef': {'name': source, 'key': key}}}


def resources(cpu, memory, max_cpu, max_memory):
    return {'requests': {'cpu': cpu, 'memory': memory}, 'limits': {'cpu': max_cpu, 'memory': max_memory}}


def http_probe(port, path, seconds=10, failures=3):
    return {'httpGet': {'path': path, 'port': port}, 'periodSeconds': seconds, 'timeoutSeconds': 5, 'failureThreshold': failures}


common = obj('ConfigMap', 'runtime', data={
    'JWT_ISSUER': 'ClimateGuard.Auth', 'JWT_AUDIENCE': 'ClimateGuard.Services',
    'AUTH_DB_HOST': 'auth-db', 'AUTH_DB_NAME': 'climateguard_auth',
    'ALERT_DB_NAME': 'climateguard_alert', 'MONGO_HOST': 'mongodb', 'MONGO_PORT': '27017',
    'COMMUNITY_SERVICE_URL': 'http://gateway:8080',
    'SENSOR_SERVICE_URL': 'http://gateway:8080',
    'ALERT_RULES_URL': 'http://legacy-api:8080/api/alert-rules/evaluation',
    'ALERT_GATEWAY_URL': 'http://gateway:8080',
})
write('base/namespace.yaml', [obj('Namespace', NS)])
write('base/runtime.yaml', [common])

routes = {}
for name, cluster, path in [
    ('auth', 'auth-service', '/api/auth/{**remainder}'),
    ('users', 'auth-service', '/api/users/{**remainder}'),
    ('roles', 'auth-service', '/api/roles/{**remainder}'),
    ('communities', 'legacy-api', '/api/communities/{**remainder}'),
    ('sensors', 'sensor-service', '/api/sensors/{**remainder}'),
    ('catalogs', 'legacy-api', '/api/catalogs/{**remainder}'),
    ('rules', 'legacy-api', '/api/alert-rules/{**remainder}'),
    ('alerts', 'alert-service', '/api/alerts/{**remainder}'),
    ('reports', 'report-service', '/api/reports/{**remainder}'),
    ('audit', 'audit-service', '/api/audit/events'),
]:
    route = {'ClusterId': cluster, 'Match': {'Path': path}}
    if name == 'auth':
        route['AuthorizationPolicy'] = 'anonymous'
    elif name in ['users', 'roles', 'reports', 'audit']:
        route['AuthorizationPolicy'] = 'Administrators'
    if name in ['auth', 'users', 'roles']:
        route['Transforms'] = [{'PathRemovePrefix': '/api'}]
    if name == 'audit':
        route['Match']['Methods'] = ['GET']
    routes[name] = route

ports = {'frontend': 8080, 'gateway': 8080, 'auth-service': 7101, 'legacy-api': 8080,
         'sensor-service': 8080, 'alert-service': 7301, 'report-service': 8000, 'audit-service': 8001}
gateway_settings = {
    'Logging': {'LogLevel': {'Default': 'Information', 'Microsoft.AspNetCore': 'Warning'}},
    'Cors': {'AllowedOrigins': ['https://climateguard.invalid']},
    'Audit': {'Enabled': True, 'IngestUrl': 'http://audit-service:8001/internal/events', 'OutboxDirectory': '/var/lib/climateguard/audit-outbox'},
    'ReverseProxy': {'Routes': routes, 'Clusters': {name: {'Destinations': {'primary': {'Address': f'http://{name}:{ports[name]}/'}}} for name in ports if name not in ['frontend', 'gateway']}},
}
(ROOT / 'base/config').mkdir(parents=True, exist_ok=True)
(ROOT / 'base/config/gateway.json').write_text(json.dumps(gateway_settings, indent=2) + '\n', encoding='utf-8')
(ROOT / 'base/config/dotnet.json').write_text(json.dumps({'Logging': {'LogLevel': {'Default': 'Information', 'Microsoft.AspNetCore': 'Warning'}}}, indent=2) + '\n', encoding='utf-8')

def jwt_env(dotnet=False):
    return [secret('Jwt__Key' if dotnet else 'JWT_ACCESS_SECRET', 'jwt', 'access-key'),
            cm('Jwt__Issuer' if dotnet else 'JWT_ISSUER', 'runtime', 'JWT_ISSUER'),
            cm('Jwt__Audience' if dotnet else 'JWT_AUDIENCE', 'runtime', 'JWT_AUDIENCE')]


settings = {
    'frontend': (101, resources('25m', '32Mi', '250m', '128Mi'), '/index.html', '/healthz'),
    'gateway': (1654, resources('100m', '128Mi', '1000m', '512Mi'), '/health/ready', '/health'),
    'auth-service': (1000, resources('100m', '128Mi', '1000m', '512Mi'), '/health', None),
    'legacy-api': (1654, resources('100m', '256Mi', '1000m', '768Mi'), '/health/database', '/health'),
    'sensor-service': (1654, resources('100m', '256Mi', '1000m', '768Mi'), '/health/database', '/health'),
    'alert-service': (10001, resources('250m', '512Mi', '1500m', '1Gi'), '/actuator/health/readiness', '/actuator/health/liveness'),
    'report-service': (10001, resources('250m', '512Mi', '1500m', '1536Mi'), '/health/database', '/health'),
    'audit-service': (10001, resources('100m', '128Mi', '1000m', '512Mi'), '/health', None),
}
deployments, services = [], []
for name, port in ports.items():
    uid, budget, ready, live = settings[name]
    environment = [] if name == 'frontend' else jwt_env(name in ['gateway', 'legacy-api', 'sensor-service'])
    volumes = [{'name': 'tmp', 'emptyDir': {'sizeLimit': '256Mi'}}]
    mounts = [{'name': 'tmp', 'mountPath': '/tmp'}]
    if name in ['gateway', 'legacy-api', 'sensor-service']:
        environment += [env('ASPNETCORE_ENVIRONMENT', 'Production'), env('ASPNETCORE_HTTP_PORTS', port)]
        volumes += [{'name': 'settings', 'configMap': {'name': 'gateway-settings' if name == 'gateway' else 'dotnet-settings'}}]
        mounts += [{'name': 'settings', 'mountPath': '/app/appsettings.json', 'subPath': 'appsettings.json', 'readOnly': True}]
    if name == 'gateway':
        environment += [secret('Audit__SigningKey', 'audit-signing', 'key')]
        volumes += [{'name': 'outbox', 'persistentVolumeClaim': {'claimName': 'gateway-outbox'}}]
        mounts += [{'name': 'outbox', 'mountPath': '/var/lib/climateguard/audit-outbox'}]
    if name == 'auth-service':
        environment += [env('NODE_ENV', 'production'), env('PORT', 7101), cm('DB_HOST', 'runtime', 'AUTH_DB_HOST'), env('DB_PORT', 5432),
                        cm('DB_NAME', 'runtime', 'AUTH_DB_NAME'), env('DB_SSL', 'false'), secret('DB_USER', 'auth-db-app', 'username'),
                        secret('DB_PASSWORD', 'auth-db-app', 'password'), secret('JWT_REFRESH_SECRET', 'jwt', 'refresh-key'),
                        env('JWT_ACCESS_TTL_SECONDS', 900), env('JWT_REFRESH_TTL_SECONDS', 604800)]
    if name in ['legacy-api', 'sensor-service']:
        environment += [secret('ConnectionStrings__ClimateGuard', 'sql-app', 'connection-string'), cm('Alerts__GatewayUrl', 'runtime', 'ALERT_GATEWAY_URL')]
    if name == 'legacy-api':
        environment += [env('Hosting__HttpsRedirectionEnabled', 'false')]
    if name == 'sensor-service':
        environment += [env('Sensor__UseSharedDatabase', 'true')]
    if name == 'alert-service':
        environment += [env('SERVER_PORT', 7301), env('SPRING_DATASOURCE_URL', 'jdbc:postgresql://alert-db:5432/climateguard_alert'),
                        secret('SPRING_DATASOURCE_USERNAME', 'alert-db-app', 'username'), secret('SPRING_DATASOURCE_PASSWORD', 'alert-db-app', 'password'),
                        cm('ALERT_RULES_URL', 'runtime', 'ALERT_RULES_URL'), env('MANAGEMENT_ENDPOINT_HEALTH_GROUP_READINESS_INCLUDE', 'readinessState,db'),
                        env('JAVA_TOOL_OPTIONS', '-XX:MaxRAMPercentage=65 -XX:InitialRAMPercentage=20'), env('SPRING_FLYWAY_ENABLED', 'true')]
    if name in ['report-service', 'audit-service']:
        who = 'REPORT' if name == 'report-service' else 'AUDIT'
        environment += [cm('MONGO_HOST', 'runtime', 'MONGO_HOST'), cm('MONGO_PORT', 'runtime', 'MONGO_PORT'),
                        env('MONGO_DATABASE', 'ClimateGuardReports' if who == 'REPORT' else 'ClimateGuardAudit'),
                        secret(f'MONGO_{who}_USERNAME', who.lower() + '-db', 'username'), secret(f'MONGO_{who}_PASSWORD', who.lower() + '-db', 'password')]
    if name == 'report-service':
        environment += [cm('COMMUNITY_SERVICE_URL', 'runtime', 'COMMUNITY_SERVICE_URL'),
                        cm('SENSOR_SERVICE_URL', 'runtime', 'SENSOR_SERVICE_URL')]
        volumes += [{'name': 'pdfs', 'persistentVolumeClaim': {'claimName': 'report-pdfs'}}]
        mounts += [{'name': 'pdfs', 'mountPath': '/opt/climateguard/services/report-service/app/generated'}]
    if name == 'audit-service':
        environment += [secret('AUDIT_INGEST_KEY', 'audit-signing', 'key')]
    if name == 'frontend':
        volumes += [{'name': 'nginx', 'configMap': {'name': 'frontend-settings'}}]
        mounts += [{'name': 'nginx', 'mountPath': '/etc/nginx/nginx.conf', 'subPath': 'nginx.conf', 'readOnly': True}]
    container = {'name': name, 'image': f'climateguard/{name}:candidate', 'imagePullPolicy': 'IfNotPresent',
                 'ports': [{'name': 'http', 'containerPort': port}], 'env': environment, 'resources': budget,
                 'securityContext': {'allowPrivilegeEscalation': False, 'readOnlyRootFilesystem': True, 'capabilities': {'drop': ['ALL']}},
                 'volumeMounts': mounts, 'readinessProbe': http_probe('http', ready),
                 'livenessProbe': http_probe('http', live, 20) if live else {'tcpSocket': {'port': 'http'}, 'periodSeconds': 20, 'timeoutSeconds': 5},
                 'startupProbe': http_probe('http', '/healthz' if name == 'frontend' else ready, 5, 60)}
    if name == 'report-service':
        container['command'] = ['python', '-m', 'uvicorn']
        container['args'] = ['app.main:app', '--host', '0.0.0.0', '--port', '8000', '--limit-concurrency', '4', '--no-access-log']
    pod = {'automountServiceAccountToken': False, 'securityContext': {'runAsNonRoot': True, 'runAsUser': uid, 'runAsGroup': uid,
           'fsGroup': uid, 'fsGroupChangePolicy': 'OnRootMismatch', 'seccompProfile': {'type': 'RuntimeDefault'}},
           'containers': [container], 'volumes': volumes, 'terminationGracePeriodSeconds': 60}
    deployment = obj('Deployment', name, {'replicas': 1, 'revisionHistoryLimit': 3,
        'strategy': {'type': 'Recreate'} if name in ['gateway', 'report-service', 'auth-service'] else {'type': 'RollingUpdate', 'rollingUpdate': {'maxUnavailable': 0, 'maxSurge': 1}},
        'selector': {'matchLabels': labels(name)}, 'template': {'metadata': {'labels': labels(name)}, 'spec': pod}}, api='apps/v1')
    deployments.append(deployment)
    services.append(obj('Service', name, {'type': 'ClusterIP', 'selector': labels(name), 'ports': [{'name': 'http', 'port': port, 'targetPort': 'http'}]}))
write('base/deployments.yaml', deployments)
write('base/services.yaml', services)
write('base/storage.yaml', [obj('PersistentVolumeClaim', name, {'accessModes': ['ReadWriteOnce'], 'storageClassName': 'local-path', 'resources': {'requests': {'storage': size}}})
                            for name, size in [('gateway-outbox', '2Gi'), ('report-pdfs', '10Gi')]])

ingress = obj('Ingress', 'public', {'ingressClassName': 'traefik',
    'tls': [{'hosts': ['climateguard.invalid'], 'secretName': 'climateguard-tls'}],
    'rules': [{'host': 'climateguard.invalid', 'http': {'paths': [
        {'path': '/api', 'pathType': 'Prefix', 'backend': {'service': {'name': 'gateway', 'port': {'number': 8080}}}},
        {'path': '/', 'pathType': 'Prefix', 'backend': {'service': {'name': 'frontend', 'port': {'number': 8080}}}},
    ]}}]}, api='networking.k8s.io/v1')
ingress['metadata']['annotations'] = {'traefik.ingress.kubernetes.io/router.entrypoints': 'websecure', 'traefik.ingress.kubernetes.io/router.tls': 'true'}
write('base/ingress.yaml', [ingress])

# Network policies use standard Kubernetes API, no controller-specific CRDs.
policies = [obj('NetworkPolicy', 'default-deny', {'podSelector': {}, 'policyTypes': ['Ingress', 'Egress']}, api='networking.k8s.io/v1'),
            obj('NetworkPolicy', 'dns', {'podSelector': {}, 'policyTypes': ['Egress'], 'egress': [{'to': [{'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': 'kube-system'}}, 'podSelector': {'matchLabels': {'k8s-app': 'kube-dns'}}}],
                'ports': [{'protocol': 'UDP', 'port': 53}, {'protocol': 'TCP', 'port': 53}]}]}, api='networking.k8s.io/v1')]
edges = {'gateway': ['auth-service', 'legacy-api', 'sensor-service', 'alert-service', 'report-service', 'audit-service'],
         'auth-service': ['auth-db'], 'legacy-api': ['sqlserver', 'gateway'], 'sensor-service': ['sqlserver', 'gateway'],
         'alert-service': ['alert-db', 'legacy-api'], 'report-service': ['mongodb', 'gateway'], 'audit-service': ['mongodb'],
         'bootstrap': ['auth-db', 'alert-db', 'mongodb', 'sqlserver']}
all_ports = {**ports, 'auth-db': 5432, 'alert-db': 5432, 'mongodb': 27017, 'sqlserver': 1433}
for source, targets in edges.items():
    for target in targets:
        to = {'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': NS}}, 'podSelector': {'matchLabels': {'app.kubernetes.io/name': target}}}
        frm = {'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': NS}}, 'podSelector': {'matchLabels': {'app.kubernetes.io/name': source}}}
        policies.append(obj('NetworkPolicy', f'{source}-to-{target}', {'podSelector': {'matchLabels': {'app.kubernetes.io/name': source}}, 'policyTypes': ['Egress'],
            'egress': [{'to': [to], 'ports': [{'protocol': 'TCP', 'port': all_ports[target]}]}]}, api='networking.k8s.io/v1'))
        policies.append(obj('NetworkPolicy', f'{target}-from-{source}', {'podSelector': {'matchLabels': {'app.kubernetes.io/name': target}}, 'policyTypes': ['Ingress'],
            'ingress': [{'from': [frm], 'ports': [{'protocol': 'TCP', 'port': all_ports[target]}]}]}, api='networking.k8s.io/v1'))
for target in ['frontend', 'gateway']:
    policies.append(obj('NetworkPolicy', target + '-from-ingress', {'podSelector': {'matchLabels': {'app.kubernetes.io/name': target}}, 'policyTypes': ['Ingress'],
        'ingress': [{'from': [{'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': 'kube-system'}}, 'podSelector': {'matchLabels': {'app.kubernetes.io/name': 'traefik'}}}],
                     'ports': [{'protocol': 'TCP', 'port': 8080}]}]}, api='networking.k8s.io/v1'))
write('base/network-policies.yaml', policies)

write('base/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'namespace': NS,
    'resources': ['namespace.yaml', 'runtime.yaml', 'deployments.yaml', 'services.yaml', 'storage.yaml', 'ingress.yaml', 'network-policies.yaml'],
    'configMapGenerator': [{'name': 'gateway-settings', 'files': ['appsettings.json=config/gateway.json']},
                           {'name': 'dotnet-settings', 'files': ['appsettings.json=config/dotnet.json']},
                           {'name': 'frontend-settings', 'files': ['nginx.conf=config/nginx.conf']}]}])

# A new, isolated single-node database profile, never an adoption of existing volumes.
db_specs = [('auth-db', 'postgres:17-bookworm', 5432, 999, '20Gi', resources('100m','256Mi','1000m','768Mi')),
            ('alert-db', 'postgres:17-bookworm', 5432, 999, '20Gi', resources('100m','256Mi','1000m','768Mi')),
            ('mongodb', 'mongo:7.0', 27017, 999, '20Gi', resources('200m','512Mi','1000m','1536Mi')),
            ('sqlserver', 'mcr.microsoft.com/mssql/server:2022-latest', 1433, 10001, '40Gi', resources('1000m','2Gi','2000m','3Gi'))]
db_docs = []
for name, image, port, uid, size, budget in db_specs:
    if name in ['auth-db', 'alert-db']:
        environment = [env('POSTGRES_USER', 'postgres'), env('POSTGRES_DB', 'postgres'), secret('POSTGRES_PASSWORD', name + '-admin', 'password'), env('PGDATA', '/var/lib/postgresql/data/pgdata')]
        mount = '/var/lib/postgresql/data'
        command = ['sh', '-ec', 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U postgres -d postgres -tAc "SELECT 1" >/dev/null']
    elif name == 'mongodb':
        environment = [secret('MONGO_INITDB_ROOT_USERNAME', 'mongo-admin', 'username'), secret('MONGO_INITDB_ROOT_PASSWORD', 'mongo-admin', 'password'), env('HOME', '/tmp')]
        mount = '/data/db'
        command = ['mongosh', '--quiet', '--nodb', '--eval', "try {const c=new Mongo('mongodb://127.0.0.1:27017'); if(!c.getDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD))quit(1);if(c.getDB('admin').runCommand({ping:1}).ok!==1)quit(1)}catch(e){quit(1)}"]
    else:
        environment = [env('ACCEPT_EULA', 'Y'), env('MSSQL_PID', 'Developer'), env('MSSQL_MEMORY_LIMIT_MB', 2048), secret('MSSQL_SA_PASSWORD', 'sql-admin', 'password')]
        mount = '/var/opt/mssql'
        command = ['sh', '-ec', 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1 -U sa -C -l 3 -b -Q "SET NOCOUNT ON; SELECT 1" -o /dev/null']
    container = {'name': name, 'image': image, 'ports': [{'name': 'db', 'containerPort': port}], 'env': environment, 'resources': budget,
        'securityContext': {'allowPrivilegeEscalation': False, 'capabilities': {'drop': ['ALL']}},
        'volumeMounts': [{'name': 'data', 'mountPath': mount}, {'name': 'tmp', 'mountPath': '/tmp'}],
        'startupProbe': {'tcpSocket': {'port': 'db'}, 'periodSeconds': 5, 'failureThreshold': 60},
        'livenessProbe': {'tcpSocket': {'port': 'db'}, 'periodSeconds': 20, 'timeoutSeconds': 5},
        'readinessProbe': {'exec': {'command': command}, 'periodSeconds': 10, 'timeoutSeconds': 5, 'failureThreshold': 3}}
    pod = {'automountServiceAccountToken': False, 'securityContext': {'runAsNonRoot': True, 'runAsUser': uid, 'fsGroup': uid, 'fsGroupChangePolicy': 'OnRootMismatch', 'seccompProfile': {'type': 'RuntimeDefault'}},
           'containers': [container], 'volumes': [{'name': 'tmp', 'emptyDir': {'sizeLimit': '256Mi'}}], 'terminationGracePeriodSeconds': 120}
    if name == 'sqlserver':
        # Microsoft binary has cap_net_bind_service=ep; dropping it prevents exec (126).
        container['securityContext']['capabilities']['add'] = ['NET_BIND_SERVICE']
        pod['nodeSelector'] = {'kubernetes.io/os': 'linux', 'kubernetes.io/arch': 'amd64'}
    db_docs += [obj('Service', name, {'clusterIP': 'None', 'selector': labels(name), 'ports': [{'name': 'db', 'port': port, 'targetPort': 'db'}]}),
                obj('StatefulSet', name, {'serviceName': name, 'replicas': 1, 'selector': {'matchLabels': labels(name)},
                    'persistentVolumeClaimRetentionPolicy': {'whenDeleted': 'Retain', 'whenScaled': 'Retain'},
                    'template': {'metadata': {'labels': labels(name)}, 'spec': pod},
                    'volumeClaimTemplates': [{'metadata': {'name': 'data'}, 'spec': {'accessModes': ['ReadWriteOnce'], 'storageClassName': 'local-path', 'resources': {'requests': {'storage': size}}}}]}, api='apps/v1')]
write('overlays/single-node/databases.yaml', db_docs)
write('overlays/single-node/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'namespace': NS, 'resources': ['../../base', 'databases.yaml']}])

hpas = [obj('HorizontalPodAutoscaler', name, {'scaleTargetRef': {'apiVersion': 'apps/v1', 'kind': 'Deployment', 'name': name}, 'minReplicas': 1, 'maxReplicas': 3 if name != 'alert-service' else 2,
    'metrics': [{'type': 'Resource', 'resource': {'name': 'cpu', 'target': {'type': 'Utilization', 'averageUtilization': 70}}}],
    'behavior': {'scaleDown': {'stabilizationWindowSeconds': 300}, 'scaleUp': {'stabilizationWindowSeconds': 60}}}, api='autoscaling/v2')
    for name in ['frontend', 'sensor-service', 'alert-service', 'audit-service']]
write('overlays/scalable/hpa.yaml', hpas)
write('overlays/scalable/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'namespace': NS, 'resources': ['../single-node', 'hpa.yaml']}])

required = {'jwt': ['access-key', 'refresh-key'], 'audit-signing': ['key'], 'auth-db-app': ['username', 'password'], 'alert-db-app': ['username', 'password'],
            'report-db': ['username', 'password'], 'audit-db': ['username', 'password'], 'sql-app': ['connection-string'],
            'auth-db-admin': ['password'], 'alert-db-admin': ['password'], 'mongo-admin': ['username', 'password'], 'sql-admin': ['password'],
            'bootstrap-admin': ['name', 'email', 'password'], 'climateguard-tls': ['tls.crt', 'tls.key']}
required.update({'community-db': ['connection-string'], 'community-db-admin': ['password']})
(ROOT / 'secrets').mkdir(exist_ok=True)
(ROOT / 'secrets/required-keys.json').write_text(json.dumps(required, indent=2) + '\n', encoding='utf-8')

# Deliberately dormant until the independent DTO/sensorCount contract is integrated.
community = copy.deepcopy(next(d for d in deployments if d['metadata']['name'] == 'legacy-api'))
community['metadata']['name'] = 'community-service'
community['spec']['replicas'] = 0
community['spec']['selector']['matchLabels'] = labels('community-service')
community['spec']['template']['metadata']['labels'] = labels('community-service')
c = community['spec']['template']['spec']['containers'][0]
c.update(name='community-service', image='climateguard/community-service:candidate', env=[
    env('ASPNETCORE_ENVIRONMENT', 'Production'), env('ASPNETCORE_HTTP_PORTS', 8080),
    secret('Jwt__AccessSecret', 'jwt', 'access-key'), cm('Jwt__Issuer', 'runtime', 'JWT_ISSUER'), cm('Jwt__Audience', 'runtime', 'JWT_AUDIENCE'),
    secret('ConnectionStrings__CommunityDatabase', 'community-db', 'connection-string')])
c['readinessProbe'] = http_probe('http', '/health')
c['startupProbe'] = http_probe('http', '/health', 5, 60)
community_db = copy.deepcopy(next(d for d in db_docs if d['kind'] == 'StatefulSet' and d['metadata']['name'] == 'auth-db'))
community_db['metadata']['name'] = 'community-db'
community_db['spec'].update(serviceName='community-db', replicas=0, selector={'matchLabels': labels('community-db')})
community_db['spec']['template']['metadata']['labels'] = labels('community-db')
cc = community_db['spec']['template']['spec']['containers'][0]
cc['name'] = 'community-db'
cc['env'] = [env('POSTGRES_USER', 'postgres'), env('POSTGRES_DB', 'postgres'), secret('POSTGRES_PASSWORD', 'community-db-admin', 'password'), env('PGDATA', '/var/lib/postgresql/data/pgdata')]
write('components/community-independent/resources.yaml', [community,
    obj('Service', 'community-service', {'type': 'ClusterIP', 'selector': labels('community-service'), 'ports': [{'name': 'http', 'port': 8080, 'targetPort': 'http'}]}),
    community_db, obj('Service', 'community-db', {'clusterIP': 'None', 'selector': labels('community-db'), 'ports': [{'name': 'db', 'port': 5432, 'targetPort': 'db'}]})])
write('components/community-independent/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'resources': ['resources.yaml']}])
optional_policies = []
for source, target, port in [('gateway','community-service',8080), ('community-service','community-db',5432), ('bootstrap','community-db',5432)]:
    peer = lambda name: {'namespaceSelector': {'matchLabels': {'kubernetes.io/metadata.name': NS}}, 'podSelector': {'matchLabels': {'app.kubernetes.io/name': name}}}
    optional_policies += [
        obj('NetworkPolicy', source + '-to-' + target, {'podSelector': {'matchLabels': {'app.kubernetes.io/name': source}}, 'policyTypes': ['Egress'], 'egress': [{'to': [peer(target)], 'ports': [{'protocol':'TCP','port':port}]}]}, api='networking.k8s.io/v1'),
        obj('NetworkPolicy', target + '-from-' + source, {'podSelector': {'matchLabels': {'app.kubernetes.io/name': target}}, 'policyTypes': ['Ingress'], 'ingress': [{'from': [peer(source)], 'ports': [{'protocol':'TCP','port':port}]}]}, api='networking.k8s.io/v1')]
write('components/community-independent/network-policies.yaml', optional_policies)
write('components/community-independent/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'resources': ['resources.yaml','network-policies.yaml']}])
write('overlays/community-review/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'namespace': NS, 'resources': ['../single-node', '../../components/community-independent']}])

job_docs = []
def job(name, image, command, environment, uid=1000):
    pod = {'restartPolicy': 'Never', 'automountServiceAccountToken': False,
           'securityContext': {'runAsNonRoot': True, 'runAsUser': uid, 'runAsGroup': uid, 'fsGroup': uid, 'seccompProfile': {'type': 'RuntimeDefault'}},
           'containers': [{'name': name, 'image': image, 'command': command, 'env': environment,
                'resources': resources('100m', '128Mi', '1000m', '512Mi'),
                'securityContext': {'allowPrivilegeEscalation': False, 'readOnlyRootFilesystem': True, 'capabilities': {'drop': ['ALL']}},
                'volumeMounts': [{'name': 'scripts', 'mountPath': '/bootstrap', 'readOnly': True}, {'name': 'tmp', 'mountPath': '/tmp'}]}],
           'volumes': [{'name': 'scripts', 'configMap': {'name': 'bootstrap-scripts'}}, {'name': 'tmp', 'emptyDir': {}}]}
    return obj('Job', name, {'backoffLimit': 0, 'activeDeadlineSeconds': 600,
        'template': {'metadata': {'labels': labels('bootstrap')}, 'spec': pod}}, api='batch/v1')

for name, database in [('auth-db', 'climateguard_auth'), ('alert-db', 'climateguard_alert')]:
    job_docs.append(job('provision-' + name, 'climateguard/auth-service:candidate', ['node', '/bootstrap/provision-postgres.cjs'], [
        env('PGHOST', name), env('APP_DATABASE', database), secret('ROOT_PASSWORD', name + '-admin', 'password'),
        secret('APP_USER', name + '-app', 'username'), secret('APP_PASSWORD', name + '-app', 'password')]))
job_docs.append(job('provision-mongo', 'climateguard/audit-service:candidate', ['python', '/bootstrap/provision-mongo.py'], [
    secret('ROOT_USER', 'mongo-admin', 'username'), secret('ROOT_PASSWORD', 'mongo-admin', 'password'),
    secret('REPORT_USER', 'report-db', 'username'), secret('REPORT_PASSWORD', 'report-db', 'password'),
    secret('AUDIT_USER', 'audit-db', 'username'), secret('AUDIT_PASSWORD', 'audit-db', 'password')], uid=10001))
auth_env = copy.deepcopy(next(d for d in deployments if d['metadata']['name'] == 'auth-service')['spec']['template']['spec']['containers'][0]['env'])
job_docs.append(job('auth-migrate', 'climateguard/auth-service:candidate', ['node', '/app/node_modules/typeorm/cli.js', 'migration:run', '-d', '/app/dist/database/data-source.js'], auth_env))
job_docs.append(job('auth-bootstrap-admin', 'climateguard/auth-service:candidate', ['node', '/bootstrap/bootstrap-admin.cjs'], auth_env + [
    secret('INITIAL_ADMIN_NAME', 'bootstrap-admin', 'name'), secret('INITIAL_ADMIN_EMAIL', 'bootstrap-admin', 'email'), secret('INITIAL_ADMIN_PASSWORD', 'bootstrap-admin', 'password')]))
job_docs.append(job('sql-empty-schema', 'mcr.microsoft.com/mssql/server:2022-latest', ['sh', '-ec',
    'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -C -b -Q "IF DB_ID(N\'ClimateGuard\') IS NULL EXEC(\'CREATE DATABASE [ClimateGuard]\')"; /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -C -b -d ClimateGuard -i /bootstrap/sql-schema.sql'],
    [secret('MSSQL_SA_PASSWORD', 'sql-admin', 'password')], uid=10001))
# Files live outside the application Kustomization: jobs require a separate, reviewed apply.
write('jobs/jobs.yaml', job_docs)
write('jobs/kustomization.yaml', [{'apiVersion': 'kustomize.config.k8s.io/v1beta1', 'kind': 'Kustomization', 'namespace': NS,
    'resources': ['jobs.yaml'], 'configMapGenerator': [{'name': 'bootstrap-scripts', 'files': [
        'scripts/provision-postgres.cjs', 'scripts/provision-mongo.py', 'scripts/bootstrap-admin.cjs', 'sql-schema.sql']}]}])
print('Generated compatibility manifests, isolated database profile and optional HPA. No cluster contacted.')

import copy
import json
import subprocess
import unittest
import sys
import tempfile
from pathlib import Path
import yaml
from validate import validate

ROOT = Path(__file__).resolve().parents[1]


class ManifestSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.valid = list(yaml.safe_load_all(subprocess.check_output(['kubectl', 'kustomize', str(ROOT / 'overlays/scalable')]).decode('utf-8')))

    def variant(self):
        return copy.deepcopy(self.valid)

    def deployment(self, docs, name):
        return next(d for d in docs if d['kind'] == 'Deployment' and d['metadata']['name'] == name)

    def test_safe_profile(self):
        self.assertEqual(validate(self.valid), [])

    def test_reports_require_sensor_upstream(self):
        docs = self.variant()
        container = self.deployment(docs, 'report-service')['spec']['template']['spec']['containers'][0]
        container['env'] = [v for v in container['env'] if v['name'] != 'SENSOR_SERVICE_URL']
        self.assertTrue(any('Report upstream' in e for e in validate(docs)))

    def test_reports_cannot_use_docker_host(self):
        docs = self.variant()
        runtime = next(d for d in docs if d['kind'] == 'ConfigMap' and d['metadata']['name'] == 'runtime')
        runtime['data']['SENSOR_SERVICE_URL'] = 'http://host.docker.internal:5147'
        self.assertTrue(any('Report upstream' in e for e in validate(docs)))

    def test_gateway_cannot_scale_with_file_outbox(self):
        docs = self.variant(); self.deployment(docs, 'gateway')['spec']['replicas'] = 2
        self.assertTrue(any('single-replica' in e for e in validate(docs)))

    def test_no_hpa_for_reports(self):
        docs = self.variant(); hpa = next(d for d in docs if d['kind'] == 'HorizontalPodAutoscaler')
        hpa['spec']['scaleTargetRef']['name'] = 'report-service'
        self.assertTrue(any('unsafe HPA' in e for e in validate(docs)))

    def test_no_plaintext_credentials(self):
        docs = self.variant(); self.deployment(docs, 'auth-service')['spec']['template']['spec']['containers'][0]['env'].append({'name': 'DB_PASSWORD', 'value': 'unit-only-not-real'})
        self.assertTrue(any('sensitive env' in e for e in validate(docs)))

    def test_no_secret_values_in_render(self):
        docs = self.variant(); docs.append({'apiVersion':'v1','kind':'Secret','metadata':{'name':'unsafe','namespace':'climateguard'},'stringData':{'key':'unit'}})
        self.assertTrue(any('Secret values' in e for e in validate(docs)))

    def test_secret_reference_must_be_declared(self):
        docs = self.variant(); self.deployment(docs, 'auth-service')['spec']['template']['spec']['containers'][0]['env'].append({'name':'DB_PASSWORD','valueFrom':{'secretKeyRef':{'name':'unknown','key':'password'}}})
        self.assertTrue(any('undeclared Secret' in e for e in validate(docs)))

    def test_service_port_must_exist(self):
        docs = self.variant(); next(d for d in docs if d['kind'] == 'Service')['spec']['ports'][0]['targetPort'] = 'absent'
        self.assertTrue(any('targetPort' in e for e in validate(docs)))

    def test_probe_must_exist(self):
        docs = self.variant(); del self.deployment(docs, 'frontend')['spec']['template']['spec']['containers'][0]['readinessProbe']
        self.assertTrue(any('probe missing' in e for e in validate(docs)))

    def test_file_backed_services_need_exclusive_rollout(self):
        docs = self.variant(); self.deployment(docs, 'report-service')['spec']['strategy'] = {'type':'RollingUpdate'}
        self.assertTrue(any('Recreate' in e for e in validate(docs)))

    def test_administrative_gateway_route_must_be_protected(self):
        docs = self.variant(); config = next(d for d in docs if d['kind']=='ConfigMap' and 'ReverseProxy' in d.get('data',{}).get('appsettings.json',''))
        data=json.loads(config['data']['appsettings.json']);data['ReverseProxy']['Routes']['users']['AuthorizationPolicy']='anonymous';config['data']['appsettings.json']=json.dumps(data)
        self.assertTrue(any('not protected' in e for e in validate(docs)))


class OAuthManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'oauth.yaml'
            subprocess.run([sys.executable, str(ROOT / 'tools/render.py'), '--profile', 'single-node',
                            '--oauth', '--domain', 'climateguard.test', '--output', str(output)],
                           check=True, capture_output=True)
            cls.valid = list(yaml.safe_load_all(output.read_text(encoding='utf-8')))

    def test_oauth_profile_is_safe(self):
        self.assertEqual(validate(self.valid), [])

    def test_oauth_callbacks_must_match_origin(self):
        docs = copy.deepcopy(self.valid)
        config = next(d for d in docs if d['kind'] == 'ConfigMap' and d['metadata']['name'] == 'oauth-settings')
        config['data']['GOOGLE_CALLBACK_URL'] = 'https://other.invalid/api/auth/callback/google'
        self.assertTrue(any('OAuth callback' in e for e in validate(docs)))

    def test_session_key_must_be_secret_reference(self):
        docs = copy.deepcopy(self.valid)
        deployment = next(d for d in docs if d['kind'] == 'Deployment' and d['metadata']['name'] == 'auth-service')
        container = deployment['spec']['template']['spec']['containers'][0]
        container['env'] = [v for v in container['env'] if v['name'] != 'OAUTH_SESSION_KEY']
        self.assertTrue(any('OAuth session key' in e for e in validate(docs)))


if __name__ == '__main__': unittest.main()

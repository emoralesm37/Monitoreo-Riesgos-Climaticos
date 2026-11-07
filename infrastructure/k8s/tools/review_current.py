"""Offline review: render public manifests, validate schemas, inventory resources.

Run in Dockerfile.validation with --network none. Never loads a kubeconfig or
Secret value, starts a workload, or contacts a database.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import yaml
from validate import validate, official_schema


def memory_mib(value):
    value = str(value)
    for suffix, factor in [('Gi', 1024), ('Mi', 1), ('Ki', 1 / 1024)]:
        if value.endswith(suffix):
            return float(value[:-len(suffix)]) * factor
    return float(value) / 1024**2


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--swagger', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    root = Path(__file__).resolve().parent
    for profile, oauth in [('single-node', False), ('single-node', True),
                           ('scalable', True), ('community-review', False), ('jobs', False)]:
        name = profile + ('-oauth' if oauth else '')
        file = args.output / (name + '.yaml')
        command = [sys.executable, str(root / 'render.py'), '--profile', profile,
                   '--domain', 'climateguard.test', '--tag', 'review-20261106', '--output', str(file)]
        if oauth:
            command.append('--oauth')
        subprocess.run(command, check=True, capture_output=True)
        docs = list(yaml.safe_load_all(file.read_text(encoding='utf-8')))
        errors = validate(docs) + official_schema(docs, args.swagger)
        if errors:
            raise RuntimeError(name + ': ' + '; '.join(errors))
        workloads = [d for d in docs if d['kind'] in ['Deployment', 'StatefulSet']]
        inventory = []
        for d in workloads:
            container = d['spec']['template']['spec']['containers'][0]
            inventory.append({'name': d['metadata']['name'], 'kind': d['kind'],
                'image': container['image'], 'replicas': d['spec'].get('replicas', 1),
                'ports': container.get('ports', []), 'resources': container['resources'],
                'uid': d['spec']['template']['spec']['securityContext'].get('runAsUser'),
                'readiness': container['readinessProbe'],
                'mounts': container.get('volumeMounts', [])})
        result = {'profile': name, 'resources': len(docs), 'validation': 'PASS',
            'requestedMemoryMiB': sum(memory_mib(w['resources']['requests']['memory']) * w['replicas'] for w in inventory),
            'memoryLimitsMiB': sum(memory_mib(w['resources']['limits']['memory']) * w['replicas'] for w in inventory),
            'workloads': inventory}
        results.append(result)
        print(json.dumps({k: v for k, v in result.items() if k != 'workloads'}))
    (args.output / 'manifest-review.json').write_text(json.dumps(results, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()

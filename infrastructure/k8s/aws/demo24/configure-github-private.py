"""Interactive GitHub-only repair. Never print credentials or authorization URLs."""
import base64
import getpass
import json
import os
from pathlib import Path
import subprocess

K = ['/usr/local/bin/k3s', 'kubectl', '-n', 'climateguard']


def run(args, **kwargs):
    result = subprocess.run(K + args, capture_output=True, text=True, **kwargs)
    if result.returncode:
        raise RuntimeError('Kubernetes operation failed; values suppressed')
    return result.stdout


def main():
    if os.geteuid() != 0 or Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip() != 'i-REPLACE_INSTANCE_ID':
        raise RuntimeError('Wrong host or permissions')
    client = getpass.getpass('GITHUB OAuth App Client ID (hidden): ').strip()
    secret = getpass.getpass('GITHUB OAuth App Client Secret (hidden): ').strip()
    if not client or not secret or any(c.isspace() for c in client) or 'googleusercontent.com' in client.lower() or client.startswith(('REPLACE_', 'ghp_', 'github_pat_')):
        raise RuntimeError('Valid GitHub OAuth App pair required; not Google or a PAT')
    obj = json.loads(run(['get', 'secret/oauth-clients', '-o', 'json']))
    before = obj['data'].copy()
    obj['data']['github-client-id'] = base64.b64encode(client.encode()).decode()
    obj['data']['github-client-secret'] = base64.b64encode(secret.encode()).decode()
    # Keep every Google/session key byte and resourceVersion; fail on concurrency.
    run(['replace', '-f', '-'], input=json.dumps(obj))
    after = json.loads(run(['get', 'secret/oauth-clients', '-o', 'json']))['data']
    unchanged = all(after.get(k) == v for k, v in before.items() if k not in ['github-client-id', 'github-client-secret'])
    if not unchanged:
        raise RuntimeError('Unexpected change to another provider; stop')
    path = Path('/srv/climateguard-demo/private/bootstrap.json')
    private = json.loads(path.read_text())
    private['oauth-clients']['github-client-id'] = client
    private['oauth-clients']['github-client-secret'] = secret
    descriptor = os.open(str(path) + '.github-new', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(private, stream)
    os.replace(str(path) + '.github-new', path)
    run(['rollout', 'restart', 'deployment/auth-service'])
    run(['rollout', 'status', 'deployment/auth-service', '--timeout=180s'])
    print(json.dumps({'githubPairUpdated': True, 'googleAndOtherKeysUnchanged': unchanged, 'authRolloutReady': True, 'secretValuesPrinted': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('GitHub-only configuration stopped; no values printed. Review privately on EC2.') from None

// For a FUTURE capacity-approved lab only. Generates new random keys in memory.
// CREATE, never APPLY: existing keys cannot be overwritten by this script.
const fs = require('fs');
const cp = require('child_process');
const crypto = require('crypto');
const kubeconfig = process.argv[2];
const context = process.argv[3];
if (!kubeconfig || !fs.existsSync(kubeconfig) || context !== 'k3d-cg-isolated-mini') {
  throw new Error('An explicit private lab kubeconfig and exact lab context are required.');
}
const namespace = 'climateguard-lab';
const base = ['--kubeconfig', kubeconfig, '--context', context, '-n', namespace];
const config = cp.spawnSync('kubectl', ['--kubeconfig', kubeconfig, '--context', context,
  'config', 'view', '--minify', '-o', 'jsonpath={.clusters[0].cluster.server}'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const url = config.status === 0 ? new URL(config.stdout.trim()) : null;
if (!url || url.protocol !== 'https:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '6550') {
  throw new Error('Refusing non-loopback lab API or unexpected port.');
}
const marker = cp.spawnSync('kubectl', [...base, 'get', 'namespace', namespace,
  '-o', 'jsonpath={.metadata.labels.climateguard\\.io/lab}'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
if (marker.status !== 0 || marker.stdout.trim() !== 'isolated-mini') {
  throw new Error('Refusing namespace without the isolated lab marker.');
}
for (const [name, key] of [['jwt', 'access-key'], ['audit-signing', 'key']]) {
  const secret = { apiVersion: 'v1', kind: 'Secret', type: 'Opaque',
    metadata: { name, namespace }, stringData: { [key]: crypto.randomBytes(32).toString('hex') } };
  // No values in process arguments, files, logs or repository.
  const result = cp.spawnSync('kubectl', [...base, 'create', '-f', '-'], {
    input: JSON.stringify(secret), encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    // Kubernetes errors can quote input. Never print stderr or retry as apply.
    throw new Error('Lab Secret creation failed; existing credentials were not replaced.');
  }
  console.log('Created new private test Secret: ' + name);
}

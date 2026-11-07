// Future in-cluster Job: private keys come only from NEW lab Secrets.
// No account login, database, OAuth provider or external host is contacted.
const dns = require('node:dns/promises');
const jwt = require('/app/node_modules/jsonwebtoken');
const namespace = 'climateguard-lab';
async function main() {
  if (!process.env.LAB_ACCESS_KEY) throw new Error('Lab Secret missing');
  const results = [];
  for (const service of ['frontend', 'gateway']) {
    const host = `${service}.${namespace}.svc.cluster.local`;
    const addresses = await dns.resolve4(host);
    results.push({ check: 'DNS', service, passed: addresses.length > 0 });
  }
  const targets = [
    ['frontend', '/healthz', 200], ['frontend', '/index.html', 200],
    ['frontend', '/oauth/callback', 200], ['gateway', '/health', 200],
    ['gateway', '/health/ready', 200], ['gateway', '/probe', 200],
    ['gateway', '/restricted', 401], ['gateway', '/restricted', 403, 'Viewer'],
    ['gateway', '/restricted', 200, 'Administrador'],
  ];
  for (const [service, route, expected, role] of targets) {
    const headers = {};
    if (role) headers.Authorization = 'Bearer ' + jwt.sign({ sub: 'isolated-probe', role }, process.env.LAB_ACCESS_KEY,
      { algorithm: 'HS256', issuer: 'cg-isolated-lab', audience: 'cg-isolated-lab', expiresIn: 60 });
    const response = await fetch(`http://${service}.${namespace}.svc.cluster.local:8080${route}`,
      { headers, signal: AbortSignal.timeout(10000), redirect: 'error' });
    results.push({ service, route, role: role || 'anonymous', status: response.status,
      expected, passed: response.status === expected });
  }
  console.log(JSON.stringify({ scope: 'K3s infrastructure and JWT policy only; no business APIs', results }));
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
main().catch(error => { console.error('Isolated probe failed: ' + error.name); process.exitCode = 1; });

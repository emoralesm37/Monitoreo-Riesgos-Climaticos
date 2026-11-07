// Test only newly-built images, without networking to any database or host port.
// No .env files, kubeconfig, existing containers or named volumes are accessed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '../../..');
const tag = process.argv[2] || 'review-20261106';
const output = process.argv[3] || path.join(os.tmpdir(), 'ClimateGuard-k3s-smoke-20261106.json');
// Optional public demo budget: verifies startup under proposed cgroup caps, not K3s.
const resourceProfile = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')).resourceBudgets : null;
const image = name => `climateguard/${name}:${tag}`;
function docker(args) {
  return cp.execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true }).trim();
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const syntheticKey = 'isolated-container-synthetic-key-only-0123456789abcdef';
const shared = { Jwt__Key: syntheticKey, Jwt__Issuer: 'isolated', Jwt__Audience: 'isolated',
  ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_HTTP_PORTS: '8080' };
const cases = [
  { name: 'frontend', port: 8080, paths: ['/healthz', '/index.html', '/oauth/callback', '/api/reports/history'],
    expected: [200, 200, 200, 404], env: {} },
  { name: 'gateway', port: 8080, paths: ['/health', '/health/ready', '/api/reports/history'],
    expected: [200, 200, 401], env: { ...shared, Audit__SigningKey: syntheticKey },
    config: 'gateway.json', tmpfs: ['/var/lib/climateguard/audit-outbox:rw,uid=1654,gid=1654,mode=0770'] },
  { name: 'legacy-api', port: 8080, paths: ['/health', '/health/database'], expected: [200, 503],
    env: { ...shared, Hosting__HttpsRedirectionEnabled: 'false',
      ConnectionStrings__ClimateGuard: 'Server=127.0.0.1,1;Database=unused;User Id=unused;Password=synthetic;Connect Timeout=1;ConnectRetryCount=0;TrustServerCertificate=True' }, config: 'dotnet.json' },
  { name: 'sensor-service', port: 8080, paths: ['/health', '/health/database', '/api/sensors/1/readings/report'],
    expected: [200, 503, 401], env: { ...shared, Sensor__UseSharedDatabase: 'true',
      ConnectionStrings__ClimateGuard: 'Server=127.0.0.1,1;Database=unused;User Id=unused;Password=synthetic;Connect Timeout=1;ConnectRetryCount=0;TrustServerCertificate=True' }, config: 'dotnet.json' },
  { name: 'report-service', port: 8000, paths: ['/health', '/health/database', '/api/reports/sensors', '/api/reports/readings'],
    expected: [200, 503, 405, 405], env: { MONGO_HOST: '127.0.0.1', MONGO_PORT: '1', MONGO_REPORT_USERNAME: 'unused',
      MONGO_REPORT_PASSWORD: 'synthetic', JWT_ACCESS_SECRET: syntheticKey, JWT_ISSUER: 'isolated', JWT_AUDIENCE: 'isolated',
      COMMUNITY_SERVICE_URL: 'http://gateway:8080', SENSOR_SERVICE_URL: 'http://gateway:8080' },
    tmpfs: ['/opt/climateguard/services/report-service/app/generated:rw,uid=10001,gid=10001,mode=0770'] },
];
async function main() {
  const results = [];
  for (const test of cases) {
    const name = 'cg-k3s-image-smoke-' + test.name + '-' + Date.now();
    const args = ['run', '-d', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,nosuid,mode=1777,size=268435456', '--name', name];
    const budget = resourceProfile?.[test.name]?.resources?.limits;
    if (budget) {
      if (!/^[0-9]+Mi$/.test(budget.memory) || !/^[0-9]+m$/.test(budget.cpu)) throw Error('Unsupported public resource budget');
      const memory = String(Number(budget.memory.slice(0, -2)) * 1024**2);
      args.push('--memory', memory, '--memory-swap', memory, '--cpus', String(Number(budget.cpu.slice(0, -1)) / 1000));
    }
    for (const mount of test.tmpfs || []) args.push('--tmpfs', mount);
    if (test.config) args.push('--mount', `type=bind,source=${path.join(root, 'infrastructure/k8s/base/config', test.config)},target=/app/appsettings.json,readonly`);
    for (const [key, value] of Object.entries(test.env)) args.push('-e', key + '=' + value);
    let id;
    try {
      id = docker([...args, image(test.name)]);
      await delay(1500);
      const checks = [];
      for (let i = 0; i < test.paths.length; i++) {
        const url = `http://127.0.0.1:${test.port}${test.paths[i]}`;
        const probe = `import urllib.request,urllib.error\ntry:\n print(urllib.request.urlopen(${JSON.stringify(url)},timeout=10).status)\nexcept urllib.error.HTTPError as e:\n print(e.code)\nexcept Exception:\n print(0)`;
        let status;
        for (let attempt = 0; attempt < 8; attempt++) {
          status = Number(docker(['run', '--rm', '--network', 'container:' + id, '--entrypoint', 'python', image('report-service'), '-c', probe]));
          if (status) break;
          await delay(1000);
        }
        checks.push({ path: test.paths[i], status, expected: test.expected[i], pass: status === test.expected[i] });
      }
      // Create only an isolated technical PDF, never a persisted business report.
      let pdf;
      if (test.name === 'report-service') {
        const code = "from app.pdf_generator import generate_data_pdf; p=generate_data_pdf('readings',[],{}); print(p.read_bytes().startswith(b'%PDF-'))";
        pdf = docker(['exec', id, 'python', '-c', code]) === 'True';
      }
      const consumption = budget ? docker(['stats', '--no-stream', '--format', '{{.MemUsage}}|{{.CPUPerc}}', id]) : undefined;
      results.push({ name: test.name, network: 'none', readOnlyRoot: true, checks,
        ...(budget ? { enforcedLimits: budget, observedDockerStats: consumption } : {}),
        ...(pdf === undefined ? {} : { writablePdfMountAndFonts: pdf }) });
      console.log(JSON.stringify(results.at(-1)));
    } finally {
      if (id) docker(['stop', '-t', '5', id]);
    }
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
  }
  if (results.some(r => r.checks.some(c => !c.pass) || r.writablePdfMountAndFonts === false)) process.exitCode = 1;
}
main().catch(() => { console.error('Image smoke test failed; no existing services were modified.'); process.exitCode = 1; });

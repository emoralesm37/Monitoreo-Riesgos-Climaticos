// Local runner: no credential values in arguments, files or console output.
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
try {
  const container = JSON.parse(cp.execFileSync('docker', ['inspect', 'cg-alertval-a60ba22-db-1'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0];
  if (!container.State.Running) throw new Error();
  const values = Object.fromEntries(container.Config.Env.map(entry => {
    const split = entry.indexOf('='); return [entry.slice(0, split), entry.slice(split + 1)];
  }));
  for (const key of ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
    if (!values[key]) throw new Error();
  }
  const env = { ...process.env,
    ALERT_DB_URL: 'jdbc:postgresql://cg-alertval-a60ba22-db-1:5432/' + values.POSTGRES_DB,
    ALERT_DB_USER: values.POSTGRES_USER, ALERT_DB_PASSWORD: values.POSTGRES_PASSWORD };
  const base = ['compose', '--env-file', 'infrastructure/mongodb/.env', '-f',
    'services/alert-service/docker-compose.local.yml'];
  const run = args => cp.execFileSync('docker', [...base, ...args], { cwd: root, env, stdio: 'inherit' });
  run(['config', '--quiet']);
  if (process.argv.includes('--build')) run(['build', 'alert-service']);
  run(['up', '-d', '--no-deps', '--no-build', 'alert-service']);
} catch {
  console.error('No se pudo iniciar Alert Service local. Revisa Docker, PostgreSQL existente y configuracion; no se generan ni muestran credenciales.');
  process.exitCode = 1;
}

// Local launcher: existing private JWT/audit keys stay in environment, never process arguments.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'services/auth-service/node_modules/dotenv'));
const auth = dotenv.parse(fs.readFileSync(path.join(root, 'services/auth-service/.env')));
const mongo = dotenv.parse(fs.readFileSync(path.join(root, 'infrastructure/mongodb/.env')));
for (const key of ['JWT_ACCESS_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE']) {
  if (!auth[key]) throw new Error('Missing private Auth setting: ' + key);
}
if (!mongo.AUDIT_INGEST_KEY) throw new Error('Missing private audit signing key.');
const directory = path.join(root, 'gateway/ClimateGuard.Gateway');
const binary = path.join(directory, 'bin/Debug/net10.0/ClimateGuard.Gateway.dll');
if (!fs.existsSync(binary)) throw new Error('Build gateway/ClimateGuard.Gateway first.');
const child = spawn('dotnet', [binary, '--urls', 'http://localhost:5147'], {
  cwd: directory,
  windowsHide: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    Jwt__Key: auth.JWT_ACCESS_SECRET,
    Jwt__Issuer: auth.JWT_ISSUER,
    Jwt__Audience: auth.JWT_AUDIENCE,
    Audit__SigningKey: mongo.AUDIT_INGEST_KEY,
    Audit__OutboxDirectory: path.join(process.env.LOCALAPPDATA, 'ClimateGuard/audit-outbox'),
  },
});
child.on('error', () => { console.error('Unable to start local Gateway.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());

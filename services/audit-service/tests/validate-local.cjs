// Explicit local end-to-end test. Creates clearly marked, inactive test resources.
// Not run by pytest. Secrets and test passwords stay in memory, never in output.
const fs = require('fs'), cp = require('child_process'), path = require('path'), os = require('os'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const dotenv = require(path.join(root, 'services/auth-service/node_modules/dotenv'));
const { Client } = require(path.join(root, 'services/auth-service/node_modules/pg'));
const a = dotenv.parse(fs.readFileSync(path.join(root, 'services/auth-service/.env')));
const m = dotenv.parse(fs.readFileSync(path.join(root, 'infrastructure/mongodb/.env')));
const delay = ms => new Promise(r => setTimeout(r, ms));
const container = 'climateguard-audit-local-audit-service-1', base = 'http://localhost:5147/api/';
const result = {}, secrets = []; let adminToken;
async function req(ep, method = 'GET', data, token = adminToken, expected = 200) {
  const r = await fetch(base + ep, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const text = await r.text();
  if (r.status !== expected) throw Error(method + ' ' + ep + ' unexpected HTTP ' + r.status);
  console.log(method + ' ' + ep + ' -> ' + r.status); return text ? JSON.parse(text) : null;
}
async function healthy() {
  for (let i = 0; i < 30; i++) { try { if ((await fetch('http://localhost:8001/health')).ok) return; } catch {} await delay(1000); }
  throw Error('Audit health timeout');
}
function saveIds() { fs.writeFileSync(path.join(os.tmpdir(), 'cg-audit-validation-results.json'), JSON.stringify(result, null, 2)); }
(async () => {
  if (!['127.0.0.1', 'localhost', '::1'].includes(a.DB_HOST) || a.DB_PORT !== '5432') throw Error('Not local DB');
  const db = new Client({ host: a.DB_HOST, port: +a.DB_PORT, database: a.DB_NAME, user: a.DB_USER, password: a.DB_PASSWORD });
  await db.connect(); const before = (await db.query('SELECT * FROM users ORDER BY id')).rows;
  try {
    const login = await req('auth/login', 'POST', { email: a.INITIAL_ADMIN_EMAIL, password: a.INITIAL_ADMIN_PASSWORD }, null);
    adminToken = login.accessToken; secrets.push(adminToken, login.refreshToken, a.INITIAL_ADMIN_PASSWORD, m.MONGO_AUDIT_PASSWORD, m.AUDIT_INGEST_KEY);
    await req('audit/events', 'GET', null, null, 401); await req('audit/events', 'POST', {}, adminToken, 405);
    const forged = await fetch('http://localhost:8001/internal/events', { method: 'POST', headers: { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ actor_id: login.user.id }) });
    if (forged.status !== 401) throw Error('Ingest not protected'); console.log('User JWT cannot forge event: 401');
    const roles = await req('roles'), role = roles.find(r => r.name === 'Operador');
    const password = crypto.randomBytes(24).toString('base64url'), email = 'prueba.auditoria.local@climateguard.test'; secrets.push(password);
    if (before.some(u => u.email === email)) throw Error('Test account exists; refusing duplicate');
    await delay(3500); cp.execFileSync('docker', ['stop', container], { stdio: 'ignore' });
    let queued;
    try {
      const user = await req('users', 'POST', { name: 'PRUEBA LOCAL AUDITORIA - NO NEGOCIO', email, password, roleId: role.id }, adminToken, 201);
      result.userId = user.id; saveIds();
      const dir = path.join(process.env.LOCALAPPDATA, 'ClimateGuard', 'audit-outbox');
      queued = fs.readdirSync(dir).filter(p => p.endsWith('.ready')).map(f => ({ raw: fs.readFileSync(path.join(dir, f), 'utf8') }))
        .map(x => ({ ...x, event: JSON.parse(x.raw) })).find(x => x.event.module === 'users' && x.event.entity_id === user.id);
      if (!queued) throw Error('Durable queue missing'); result.queuedEventId = queued.event.event_id; saveIds();
      console.log('Audit outage: business 201 and real event persisted on disk');
    } finally { cp.execFileSync('docker', ['start', container], { stdio: 'ignore' }); }
    await healthy(); await delay(5500);
    let page = await req('audit/events?page_size=100');
    if (!page.items.some(e => e.event_id === result.queuedEventId)) throw Error('Retry did not deliver');
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac('sha256', m.AUDIT_INGEST_KEY).update(ts + '.' + queued.raw).digest('hex');
    const replay = await fetch('http://localhost:8001/internal/events', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Audit-Timestamp': ts, 'X-Audit-Signature': signature }, body: queued.raw });
    if (replay.status !== 200 || !(await replay.json()).duplicate) throw Error('Idempotency failed');
    console.log('Real queued event replay: 200 duplicate=true, no second insert');
    await req('users/' + result.userId, 'PATCH', { name: 'PRUEBA LOCAL AUDITORIA - EDITADO', roleId: role.id });
    const opLogin = await req('auth/login', 'POST', { email, password }, null); secrets.push(opLogin.accessToken, opLogin.refreshToken);
    await req('audit/events', 'GET', null, opLogin.accessToken, 403);
    await req('users/' + result.userId + '/status', 'PATCH', { isActive: false }, opLogin.accessToken, 403);
    await req('auth/login', 'POST', { email, password: crypto.randomBytes(32).toString('hex') }, null, 401);
    const community = await req('communities', 'POST', { name: 'PRUEBA LOCAL AUDITORIA - SIN UBICACION', municipality: 'PRUEBA LOCAL', department: 'PRUEBA LOCAL', country: 'Guatemala', latitude: null, longitude: null, description: 'Recurso local controlado para validar auditoria; no representa una ubicacion real.' }, adminToken, 201);
    result.communityId = community.communityId; saveIds();
    const sensor = await req('sensors', 'POST', { name: 'PRUEBA LOCAL AUDITORIA - MANUAL SIN HARDWARE', sensorTypeId: 1, communityId: community.communityId }, adminToken, 201);
    result.sensorId = sensor.sensorId; saveIds();
    const rule = await req('alert-rules', 'POST', { name: 'PRUEBA LOCAL AUDITORIA - SOLO VALIDACION', sensorTypeId: 1, minimumValue: -50, maximumValue: 50, alertSeverityId: 4, phenomenonTypeId: 4, message: 'PRUEBA LOCAL AUDITORIA: lectura manual, sin hardware.' }, adminToken, 201);
    result.ruleId = rule.alertRuleId; saveIds();
    try {
      await req('sensors/' + sensor.sensorId + '/readings/manual', 'POST', { value: 100 });
      let alerts = [];
      for (let i = 0; i < 30; i++) { const r = await fetch(base + 'alerts?sensorId=' + sensor.sensorId, { headers: { Authorization: 'Bearer ' + adminToken } }); alerts = await r.json(); if (alerts.some(e => e.status === 'ACTIVA')) break; await delay(1000); }
      const active = alerts.find(e => e.status === 'ACTIVA' && e.ruleId === rule.alertRuleId);
      if (!active) throw Error('Manual alert not delivered'); result.alertId = active.alertId; saveIds();
      await req('alerts/' + active.alertId + '/resolve', 'PATCH');
    } finally {
      await req('alert-rules/' + rule.alertRuleId + '/status', 'PATCH', { isActive: false }, adminToken, 204);
      await req('sensors/' + sensor.sensorId + '/status', 'PATCH', { isActive: false }, adminToken, 204);
      await req('communities/' + community.communityId + '/status', 'PATCH', { isActive: false }, adminToken, 204);
    }
    const report = await req('reports/communities', 'POST'); result.reportId = report.report_id; saveIds();
    const download = await fetch(base + 'reports/' + report.report_id + '/download', { headers: { Authorization: 'Bearer ' + adminToken } });
    const pdf = Buffer.from(await download.arrayBuffer()); if (download.status !== 200 || pdf.subarray(0, 5).toString() !== '%PDF-') throw Error('PDF failed');
    console.log('Real PDF download 200, ' + pdf.length + ' bytes');
    await req('users/' + result.userId + '/status', 'PATCH', { isActive: false });
    await delay(5500); page = await req('audit/events?page_size=100');
    for (const mod of ['auth', 'users', 'communities', 'sensors', 'alerts', 'reports', 'alert-rules']) if (!page.items.some(e => e.module === mod && e.result === 'CONFIRMED')) throw Error('Missing confirmed module ' + mod);
    if (!page.items.some(e => e.result === 'FAILED' && e.http_status === 403 && e.actor_id === result.userId)) throw Error('Denied action missing');
    for (const secret of secrets.filter(s => s && s.length > 6)) if (JSON.stringify(page).includes(secret)) throw Error('Sensitive value detected in audit');
    console.log('All seven modules have real confirmed events; failed attempt attributed to Operator; no tested secret values in events');
    const after = (await db.query('SELECT * FROM users ORDER BY id')).rows;
    for (const old of before) if (JSON.stringify(after.find(u => u.id === old.id)) !== JSON.stringify(old)) throw Error('Existing user modified');
    console.log('All pre-existing users unchanged');
    cp.execFileSync('docker', ['restart', container], { stdio: 'ignore' }); await healthy();
    const persisted = await req('audit/events?module=users&page_size=100');
    if (persisted.items.filter(e => e.event_id === result.queuedEventId).length !== 1) throw Error('Restart persistence failed');
    await req('audit/events?page=1&page_size=2&action=create'); console.log('Restart persistence and pagination verified');
  } finally { if (result.userId && adminToken) await req('users/' + result.userId + '/status', 'PATCH', { isActive: false }); await db.end(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });

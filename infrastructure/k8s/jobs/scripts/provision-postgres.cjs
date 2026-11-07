// Explicit bootstrap for a reviewed NEW namespace database. Never rotates a role.
const { Client } = require('/app/node_modules/pg');
const e = process.env;
let bootstrapStage = 'validate-input';
const identifier = value => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value || '')) throw Error('Invalid identifier');
  return '"' + value + '"';
};
(async () => {
  const username = identifier(e.APP_USER), database = identifier(e.APP_DATABASE);
  if (['postgres','template0','template1'].includes(e.APP_DATABASE) || e.APP_USER === 'postgres') throw Error('Invalid application identity');
  bootstrapStage = 'root-connect';
  let root;
  // A new Job may start before CNI policy/endpoints are usable. Retry transport only;
  // authentication, SQL and privilege failures remain fatal and never rotate a role.
  for (let attempt=1;attempt<=8;attempt++) {
    const client=new Client({host:e.PGHOST,port:5432,user:'postgres',password:e.ROOT_PASSWORD,database:'postgres',connectionTimeoutMillis:5000});
    try { await client.connect(); root=client; break; }
    catch (error) {
      await client.end().catch(()=>{});
      if (attempt===8 || !['ECONNREFUSED','ECONNRESET','ETIMEDOUT','EHOSTUNREACH','EAI_AGAIN','ENOTFOUND'].includes(error.code)) throw error;
      console.log(JSON.stringify({stage:'root-connect',attempt,transportCode:error.code}));
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
  }
  try {
    bootstrapStage = 'root-settings';
    // Prevent credential-bearing DDL from being printed on statement errors.
    await root.query("SET log_statement = 'none'");
    await root.query("SET log_min_error_statement = 'panic'");
    await root.query('SET standard_conforming_strings = on');
    bootstrapStage = 'role-inspect';
    const role = await root.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[e.APP_USER]);
    if (!role.rowCount) {
      bootstrapStage = 'role-create';
      if (!e.APP_PASSWORD) throw Error('Missing application credential');
      await root.query(`CREATE ROLE ${username} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${e.APP_PASSWORD.replaceAll("'","''")}'`);
    } else if (role.rows[0].rolsuper || role.rows[0].rolcreatedb || role.rows[0].rolcreaterole) throw Error('Existing role requires privilege review');
    bootstrapStage = 'database-inspect';
    const db = await root.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',[e.APP_DATABASE]);
    if (!db.rowCount) await root.query(`CREATE DATABASE ${database} OWNER ${username}`);
    else if (db.rows[0].owner !== e.APP_USER) throw Error('Existing database requires ownership review');
    bootstrapStage = 'application-connect';
    const check = new Client({host:e.PGHOST,port:5432,user:e.APP_USER,password:e.APP_PASSWORD,database:e.APP_DATABASE});
    await check.connect(); await check.query('SELECT 1'); await check.end();
    console.log('Application database provisioned/verified. Existing passwords were not changed.');
  } finally { await root.end(); }
})().catch(error=>{console.error(JSON.stringify({stage:bootstrapStage,kind:error.name,code:error.code||null}));console.error('Database bootstrap failed; no existing credential was replaced.');process.exitCode=1;});

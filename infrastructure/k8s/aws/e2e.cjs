// Prepared acceptance runner. NOT executed by preparation or deployment scripts.
// Use dedicated NEW-environment accounts only; OAuth success stays interactive.
// Outputs check names/statuses only, never response bodies, credentials or tokens.
const base = new URL(process.argv[2] || 'https://climateguard.garher.lat');
if (base.protocol !== 'https:' || base.hostname !== 'climateguard.garher.lat' || base.username || base.password || base.port) throw Error('Expected final HTTPS domain');
const accounts = process.argv.includes('--accounts');
const reports = process.argv.includes('--reports');
if ((accounts || reports) && process.env.CG_E2E_APPROVED_NEW_ENV !== 'yes') throw Error('Dedicated new environment approval is required');
if (reports && !accounts) throw Error('Report generation requires account checks');
const results = [];
async function request(name, route, expected, {token, body, method='GET'}={}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer '+token;
  if (body !== undefined) headers['Content-Type']='application/json';
  const response = await fetch(new URL(route,base), {method,headers,
    ...(body === undefined ? {} : {body:JSON.stringify(body)}), redirect:'manual',signal:AbortSignal.timeout(30000)});
  const bytes = Buffer.from(await response.arrayBuffer());
  const passed = response.status === expected;
  results.push({name,status:response.status,expected,passed});
  if (!passed) throw Error('Unexpected HTTP status');
  return {bytes,json:()=>JSON.parse(bytes.toString())};
}
function check(name, passed) {results.push({name,passed});if(!passed)throw Error('Acceptance assertion failed');}
async function main() {
  await request('Angular', '/',200);
  await request('OAuth SPA','/oauth/callback',200);
  await request('OAuth status','/api/auth/oauth/status',200);
  for (const provider of ['google','github']) await request('Reject invalid callback '+provider,'/api/auth/callback/'+provider+'?state=invalid',303);
  for (const route of ['/api/users','/api/reports/history','/api/audit/events']) await request('Anonymous '+route,route,401);
  if (!accounts) return;
  for (const role of ['ADMIN','VIEWER']) {
    const email=process.env['CG_E2E_'+role+'_EMAIL'],password=process.env['CG_E2E_'+role+'_PASSWORD'];
    if (!email || !password) throw Error('Dedicated account input missing');
    let pair=(await request('Login '+role,'/api/auth/login',200,{method:'POST',body:{email,password}})).json();
    try {
      const claims=JSON.parse(Buffer.from(pair.accessToken.split('.')[1],'base64url').toString());
      check('JWT claims '+role,claims.role===(role==='ADMIN'?'Administrador':'Viewer') && Array.isArray(claims.roles) && Array.isArray(claims.permissions) && claims.provider==='local');
      for (const route of ['/api/communities','/api/sensors','/api/catalogs/sensor-types','/api/alerts'])
        await request(role+' '+route,route,200,{token:pair.accessToken});
      for (const route of ['/api/users','/api/reports/history','/api/audit/events'])
        await request(role+' '+route,route,role==='ADMIN'?200:403,{token:pair.accessToken});
      if (reports && role==='ADMIN') {
        for (const type of ['communities','sensors','readings']) {
          const generated=(await request('Generate '+type,'/api/reports/'+type,200,{method:'POST',token:pair.accessToken,...(type==='communities'?{}:{body:{}})})).json();
          const pdf=await request('Download '+type,'/api/reports/'+encodeURIComponent(generated.report_id)+'/download',200,{token:pair.accessToken});
          check('PDF signature '+type,pdf.bytes.subarray(0,5).toString()==='%PDF-');
        }
      }
      const old=pair.refreshToken;
      pair=(await request('Rotate refresh '+role,'/api/auth/refresh',200,{method:'POST',body:{refreshToken:old}})).json();
      check('Refresh changed '+role,pair.refreshToken!==old);
      check('Refresh preserves local provider '+role,JSON.parse(Buffer.from(pair.accessToken.split('.')[1],'base64url').toString()).provider==='local');
      await request('Reject refresh replay '+role,'/api/auth/refresh',401,{method:'POST',body:{refreshToken:old}});
    } finally {
      await request('Logout '+role,'/api/auth/logout',200,{method:'POST',body:{refreshToken:pair.refreshToken}});
      await request('Reject logged-out refresh '+role,'/api/auth/refresh',401,{method:'POST',body:{refreshToken:pair.refreshToken}});
    }
  }
}
main().catch(()=>{process.exitCode=1;results.push({name:'Runner stopped; inspect privately',passed:false});})
  .finally(()=>console.log(JSON.stringify({scope:'HTTPS Gateway acceptance; real OAuth success and durability require separate manual tests',results})));

/* Real Chrome UI against AWS. Only generated technical accounts; no provider login.
 * Never print credentials, response bodies, cookies, storage or URL queries.
 * Run with CG_PLAYWRIGHT pointing to an installed Playwright module.
 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {chromium}=require(process.env.CG_PLAYWRIGHT);
const HOST='https://climateguard.garher.lat';
const out=path.join(__dirname,'browser-evidence-20261106');
fs.mkdirSync(out,{recursive:true});
const checks=[],http=[],mapExceptions=[],failedRequests=[];let current='setup';
function check(name,ok,details={}){current=name;checks.push({name,passed:!!ok,...details});if(!ok)throw new Error('Assertion failed');}
const key=path.join(process.env.USERPROFILE,'.ssh','ClimateGuard-Key.pem');
const privateCode="import json\np='/srv/climateguard-demo/private/'\na=json.load(open(p+'bootstrap.json'))['bootstrap-admin']\nv=json.load(open(p+'e2e-state.json'))['viewer']\nprint(json.dumps({'admin':{'email':a['email'],'password':a['password']},'viewer':v}))\n";
async function main(){
 // stdout is captured directly in memory, never logged or persisted.
 const accounts=JSON.parse(cp.execFileSync('ssh',['-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-i',key,'ubuntu@EC2_PUBLIC_IP','sudo -n python3 -'],{input:privateCode,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cg-acceptance-'));
 const chrome=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore',windowsHide:true});
 let browser;
 try{
  let port;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,200));try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}}
  check('Chrome starts without disabling Safe Browsing',!!port);
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  for(const role of ['admin','viewer']){
   const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
   const page=await context.newPage();
   page.on('response',r=>{const u=new URL(r.url());if(u.origin===HOST&&u.pathname.startsWith('/api/'))http.push({role,method:r.request().method(),path:u.pathname,status:r.status()});});
   page.on('requestfailed',r=>{const u=new URL(r.url());failedRequests.push({host:u.hostname,path:u.pathname,error:r.failure()?.errorText});});
   current=role+' UI login';await page.goto(HOST+'/login');
   await page.locator('#email').fill(accounts[role].email);await page.locator('#password').fill(accounts[role].password);
   await page.locator('button.submit-button').click();await page.waitForURL('**/dashboard',{timeout:30000});
   check(role+' logs in through UI',new URL(page.url()).pathname==='/dashboard');
   for(const route of ['/dashboard','/comunidades','/sensores','/alertas',...(role==='admin'?['/usuarios','/historial','/reportes']:[])]){
    current=role+' route '+route;await page.goto(HOST+route);await page.waitForLoadState('networkidle');
    check(role+' renders '+route,new URL(page.url()).pathname===route && await page.locator('main').count()>0);
    const alerts=await page.locator('[role="alert"]:visible').allTextContents();
    await page.screenshot({path:path.join(out,role+route.replaceAll('/','-')+'.png'),fullPage:true});
    check(role+' no error notices '+route,!alerts.some(t=>/no pudimos|error al|no se pudo|informaci.n parcial/i.test(t)),{noticeCount:alerts.length,notices:alerts.map(t=>t.replace(/https?:\/\/\S+/g,'[URL suppressed]').slice(0,400))});
    if(route==='/dashboard'){
     await page.waitForFunction(()=>[...document.querySelectorAll('[data-metric]')].every(e=>!['...','—'].includes(e.textContent.trim())));
     current=role+' dashboard metrics';
     const data=await page.evaluate(async()=>{
      const session=JSON.parse(sessionStorage.getItem('climateguard_user'));const headers={Authorization:'Bearer '+session.token};
      const [c,s,a]=await Promise.all(['/api/communities','/api/sensors','/api/alerts'].map(async p=>{const r=await fetch(p,{headers});if(!r.ok)throw Error('API failed');return r.json();}));
      return {api:{communities:c.length,sensors:s.length,'active-sensors':s.filter(x=>x.isActive===true).length,'active-alerts':a.filter(x=>x.status==='ACTIVA').length,'resolved-alerts':a.filter(x=>x.status==='RESUELTA').length},ui:Object.fromEntries([...document.querySelectorAll('[data-metric]')].map(e=>[e.dataset.metric,Number(e.textContent.trim())]))};
     });
     check(role+' dashboard metrics match APIs',Object.entries(data.api).every(([k,v])=>data.ui[k]===v),data);
     await page.locator('#dashboard-community').selectOption(process.env.CG_COMMUNITY_UNDER_TEST||'1');await page.locator('#dashboard-sensor').selectOption(process.env.CG_SENSOR_UNDER_TEST||'1');
     await page.waitForSelector('svg.reading-chart circle.series-point',{timeout:15000});
     check(role+' persisted reading plotted',await page.locator('svg.reading-chart circle.series-point').count()>=1);
    }
    if(['/comunidades','/sensores'].includes(route))check(role+' technical fixture visible '+route,(await page.locator('body').innerText()).includes('TEST K3S'));
    await page.screenshot({path:path.join(out,role+route.replaceAll('/','-')+'.png'),fullPage:true});
   }
   if(role==='admin'){
    for(const kind of (process.env.CG_ALL_REPORTS==='1'?['communities','sensors','readings','alerts','events','sensor_status','climate_statistics','executive']:['communities','sensors','readings'])){
     current='UI PDF '+kind;
     await page.getByLabel('Tipo de reporte',{exact:true}).selectOption(kind);
     if(kind!=='communities'){
      await page.getByLabel('Sensor',{exact:true}).selectOption({label:'TEST K3S sensor manual'});
     }
     const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/reports/'+kind && r.request().method()==='POST');
     await page.getByRole('button',{name:'Generar reporte',exact:true}).click();
     const response=await responsePromise;check('UI generates '+kind+' PDF',response.status()===200);
     await page.waitForLoadState('networkidle');
     const downloadPromise=page.waitForEvent('download',{timeout:20000});
     await page.locator('tbody tr').first().getByRole('button',{name:/Descargar/}).click();
     const download=await downloadPromise;const file=path.join(out,'ui-'+kind+'.pdf');await download.saveAs(file);
     const raw=fs.readFileSync(file);check('UI downloads '+kind+' PDF',raw.subarray(0,5).toString()==='%PDF-'&&raw.length>1000,{bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
    }
    await page.reload();await page.waitForLoadState('networkidle');check('Report history survives browser reload',await page.locator('tbody tr').count()>=6);
    await page.screenshot({path:path.join(out,'admin-reportes-generated.png'),fullPage:true});
   }else{
    for(const route of ['/usuarios','/historial','/reportes','/reglas']){
     await page.goto(HOST+route);await page.waitForURL('**/dashboard');check('Viewer route guard '+route,new URL(page.url()).pathname==='/dashboard');
    }
   }
   // Revoke this generated technical session; do not print storage or tokens.
   await page.evaluate(async()=>{const s=JSON.parse(sessionStorage.getItem('climateguard_user'));if(s?.refreshToken)await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:s.refreshToken})});sessionStorage.removeItem('climateguard_user');});
   await context.close();
  }
 }finally{if(browser)await browser.close();if(chrome.exitCode===null)chrome.kill();}
}
main().then(()=>finish(true)).catch(()=>finish(false));
function finish(passed){const evidence={atUtc:new Date().toISOString(),passed,failedAt:passed?null:current,checks,http,mapExceptions,failedRequests,realOAuthAccountsAutomated:false,secretValuesPrinted:false};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed,checks:checks.length,failedAt:evidence.failedAt,mapExceptions,failedRequests,httpErrors:http.filter(x=>x.status>=400)}));process.exitCode=passed?0:1;}

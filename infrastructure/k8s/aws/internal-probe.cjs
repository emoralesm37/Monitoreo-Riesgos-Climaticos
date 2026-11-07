// Prepared Job: real DNS + dependency readiness, no credentials or business writes.
const dns = require('node:dns/promises');
const targets = [
  ['frontend',8080,'/healthz'], ['gateway',8080,'/health/ready'],
  ['auth-service',7101,'/health'], ['legacy-api',8080,'/health/database'],
  ['sensor-service',8080,'/health/database'], ['alert-service',7301,'/actuator/health/readiness'],
  ['report-service',8000,'/health/database'], ['audit-service',8001,'/health'],
];
async function main() {
  const results=[];
  async function transport(action) {
    let last;
    for(let attempt=0;attempt<6;attempt++) {
      try{return await action();}catch(error){last=error;if(attempt<5)await new Promise(r=>setTimeout(r,2000));}
    }
    throw last;
  }
  for (const [name,port,route] of targets) {
    const host=name+'.climateguard.svc.cluster.local';
    try {
      const addresses=await transport(()=>dns.resolve4(host));
      results.push({name,check:'DNS',passed:addresses.length>0});
      const response=await transport(()=>fetch('http://'+host+':'+port+route,{signal:AbortSignal.timeout(10000),redirect:'error'}));
      await response.arrayBuffer();
      results.push({name,check:'readiness',status:response.status,passed:response.status===200});
    } catch {results.push({name,check:'DNS/readiness',passed:false});}
  }
  console.log(JSON.stringify({scope:'real internal readiness; not business E2E',results}));
  if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(()=>{console.error('Internal acceptance failed');process.exitCode=1;});

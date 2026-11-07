// Local only: records effective source hashes, builds sequentially, never pushes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'ClimateGuard-aws-release-20261106'));
fs.mkdirSync(out, { recursive: true });
const run = (cmd, args) => cp.execFileSync(cmd, args, {cwd:root, windowsHide:true, encoding:'utf8', maxBuffer:16*1024**2, stdio:['ignore','pipe','pipe']}).trim();
const services = ['frontend','gateway','auth-service','legacy-api','sensor-service','alert-service','report-service','audit-service','community-service'];
const files = run('git', ['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean)
  .filter(f => /^(frontend\/|gateway\/ClimateGuard.Gateway\/|backend\/|services\/|infrastructure\/k8s\/(images\/|base\/config\/))/.test(f))
  .filter(f => !/(^|\/)(node_modules|dist|bin|obj|target|coverage|\.venv|venv|__pycache__|generated|\.angular|\.private)(\/|$)/.test(f))
  .filter(f => !/(^|\/)(\.env[^/]*|appsettings[^/]*\.json)$|\.(pem|key|pfx|pdf|log|pyc)$/i.test(f))
  .filter(f => fs.existsSync(path.join(root,f)) && fs.statSync(path.join(root,f)).isFile()).sort();
const sources = files.map(file => ({file, sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
const fingerprint = crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex');
const tag = 'release-20261106-' + fingerprint.slice(0,12);
const result = {createdAt:new Date().toISOString(), head:run('git',['rev-parse','HEAD']), dirtyTree:true,
  sourceFingerprint:fingerprint, sourceScope:'Application sources and image/config inputs; excludes credentials, appsettings and generated artifacts. Not a backup of the entire worktree.',
  tag, sources, images:[], published:false, productionReady:false};
const save = () => fs.writeFileSync(path.join(out,'release-lock.json'), JSON.stringify(result,null,2));
save();
for (const name of services) {
  const own = ['report-service','audit-service'].includes(name);
  const dockerfile = own ? `services/${name}/Dockerfile` : `infrastructure/k8s/images/${name}.Dockerfile`;
  const context = own ? `services/${name}` : '.';
  const image = `climateguard/${name}:${tag}`;
  const log = fs.openSync(path.join(out,name+'.build.log'),'w');
  const started = Date.now();
  const build = cp.spawnSync('docker',['build','--platform','linux/amd64','-f',dockerfile,'-t',image,context],
    {cwd:root,windowsHide:true,stdio:['ignore',log,log]});
  fs.closeSync(log);
  if (build.status !== 0) {result.failure={service:name,exit:build.status};save();throw Error('Build failed for '+name+'; inspect private local build log.');}
  const info = JSON.parse(run('docker',['image','inspect',image,'--format','{{json .}}']));
  const entry = {name,image,id:info.Id,size:info.Size,platform:info.Os+'/'+info.Architecture,user:info.Config.User,
    repoDigests:info.RepoDigests,elapsedSeconds:Math.round((Date.now()-started)/1000),dockerfile,context};
  result.images.push(entry);save();console.log(JSON.stringify(entry));
}
console.log('Prepared local release '+tag+'; no publication or deployment performed.');

// Binary-safe Windows -> SSH -> native K3s import. No registry, archive file or secrets printed.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../../..');
const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'candidate/release-lock.json')));
const key=path.join(require('os').homedir(),'.ssh','ClimateGuard-Key.pem');
const host='ubuntu@EC2_PUBLIC_IP';
function run(command,args){return cp.execFileSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
for(const item of lock.sources){if(!fs.existsSync(path.join(root,item.file))||crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex')!==item.sha256)throw Error('Source changed since release: '+item.file);}
for(const item of lock.images){if(run('docker',['image','inspect',item.image,'--format','{{.Id}}'])!==item.id)throw Error('Image identity changed: '+item.name);}
const sshArgs=['-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-i',key,host];
const instance=run('ssh',[...sshArgs,'cat /sys/devices/virtual/dmi/id/board_asset_tag']);
if(instance!=='i-REPLACE_INSTANCE_ID')throw Error('Wrong EC2 target');
const started=Date.now();
const importer=cp.spawn('ssh',[...sshArgs,'sudo -n /usr/local/bin/k3s ctr images import --all-platforms --no-unpack -'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
const exporter=cp.spawn('docker',['save',...lock.images.map(i=>i.image)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let bytes=0;const hash=crypto.createHash('sha256');
exporter.stdout.on('data',data=>{bytes+=data.length;hash.update(data);});
exporter.stdout.pipe(importer.stdin);
exporter.stderr.on('data',data=>process.stderr.write(data));
importer.stdout.on('data',data=>process.stdout.write(data));
importer.stderr.on('data',data=>process.stderr.write(data));
importer.stdin.on('error',()=>exporter.kill());
const done=child=>new Promise(resolve=>{child.on('close',resolve);child.on('error',()=>resolve(-1));});
Promise.all([done(exporter),done(importer)]).then(([saveExit,importExit])=>{
  const result={atUtc:new Date().toISOString(),instanceId:instance,tag:lock.tag,images:lock.images.length,
    bytes,streamSha256:hash.digest('hex'),elapsedSeconds:Math.round((Date.now()-started)/1000),saveExit,importExit,
    registryPush:false,awsResourcesCreated:0};
  fs.writeFileSync(path.join(__dirname,'image-transfer-evidence.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(saveExit!==0||importExit!==0)process.exitCode=1;
});

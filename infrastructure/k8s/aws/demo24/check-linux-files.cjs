// Byte-level guard: no shell execution or credentials.
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
let count=0;
const errors=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.private','.rendered','__pycache__','bin','obj'].includes(item.name))continue;
  const file=path.join(dir,item.name);
  if(item.isDirectory())walk(file);
  else if(item.name.endsWith('.sh')){
    count++;const bytes=fs.readFileSync(file);
    if(bytes.includes(13))errors.push(path.relative(root,file)+': contains CR');
    if(bytes.subarray(0,3).equals(Buffer.from([239,187,191])))errors.push(path.relative(root,file)+': UTF-8 BOM');
  }
}}
walk(root);
console.log(JSON.stringify({linuxScriptsChecked:count,errors}));
if(errors.length)process.exitCode=1;

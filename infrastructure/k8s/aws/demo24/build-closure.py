"""EC2 bounded sequential image layering using the already imported runtimes."""
import json
from pathlib import Path
import subprocess
import sys

root=Path(sys.argv[1]);baseline='release-20261106-f0048fcb2ff2';tag='fase3-close2-20261106'
def available():
    values={line.split(':')[0]:int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
    return values['MemAvailable']//1024
results=[]
for kind in ['report','community','sensor','gateway','frontend']:
    if available()<2300:raise SystemExit('Insufficient memory margin; existing workloads unchanged')
    image=kind+'-service' if kind in ['report','community','sensor'] else kind
    base='docker.io/climateguard/'+image+':'+baseline
    inspect=subprocess.run(['docker','image','inspect',base,'--format','{{.Id}}'],capture_output=True,text=True)
    if inspect.returncode:
        exporter=subprocess.Popen(['k3s','ctr','images','export','-',base],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        load=subprocess.run(['docker','load'],stdin=exporter.stdout,capture_output=True)
        exporter.stdout.close()
        if exporter.wait() or load.returncode:raise SystemExit('Existing runtime image export/load failed')
    ref='climateguard/'+image+':'+tag
    build=subprocess.run(['docker','build','--network=none','--pull=false','-t',ref,str(root/kind)],capture_output=True,text=True)
    (root/(kind+'-build.log')).write_text(build.stdout+build.stderr)
    if build.returncode:raise SystemExit('Build failed: '+kind+'; no deployment applied')
    export=subprocess.Popen(['docker','save',ref],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    result=subprocess.run(['k3s','ctr','images','import','--all-platforms','--no-unpack','-'],stdin=export.stdout,capture_output=True)
    export.stdout.close()
    if export.wait() or result.returncode:raise SystemExit('Runtime import failed: '+kind)
    digest=subprocess.check_output(['docker','image','inspect',ref,'--format','{{.Id}}'],text=True).strip()
    item={'image':ref,'digest':digest,'memoryAvailableMiB':available()};results.append(item)
    print(json.dumps(item),flush=True)
(root/'images.json').write_text(json.dumps(results,indent=2))

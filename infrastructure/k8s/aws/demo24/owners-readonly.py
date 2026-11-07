"""Linux root read-only discovery. No cmdlines, environments, logs or config dumps.

Run: sudo python3 owners-readonly.py
Finds listener PIDs, cgroups/systemd units and Docker identities/restart policies.
Never stops a process or writes a server file.
"""
import json
import datetime as dt
from pathlib import Path
import re
import subprocess

PORTS={80,443,5147,7101,7102,7000,1433,5432}

def run(args):
    result=subprocess.run(args,capture_output=True,text=True,timeout=20)
    return result.returncode,result.stdout

def discover():
    code,sockets=run(['ss','-H','-lntp'])
    result={'measuredAtUtc':dt.datetime.now(dt.timezone.utc).isoformat(),
        'readOnly':True,'ssAvailable':code==0,'listeners':[],'containers':[],'serviceStates':[]}
    units={'nginx.service','docker.service','docker.socket','containerd.service','k3s.service'}
    for line in sockets.splitlines():
        fields=line.split()
        if len(fields)<4:
            continue
        address=fields[3]
        try: port=int(address.rsplit(':',1)[1])
        except (ValueError,IndexError): continue
        if port not in PORTS: continue
        entry={'port':port,'address':address,'owners':[]}
        for process,pid in re.findall(r'\("([^"\n]+)",pid=(\d+)',line):
            owner={'pid':int(pid),'process':process,'units':[]}
            try:
                groups=Path('/proc',pid,'cgroup').read_text()
                owner['units']=sorted(set(re.findall(r'/([^/\n]+\.service)(?:/|$)',groups,re.MULTILINE)))
                owner['executable']=str(Path('/proc',pid,'exe').resolve())
                owner['cwd']=str(Path('/proc',pid,'cwd').resolve())
            except OSError:
                owner['inspection']='PROCESS_CHANGED_OR_ACCESS_DENIED'
            units.update(owner['units'])
            entry['owners'].append(owner)
        result['listeners'].append(entry)
    # Inspect only explicitly selected safe metadata. Never request Config.Env/Args.
    try:
        code,ids=run(['docker','ps','-q'])
        template='{"id":{{json .Id}},"name":{{json .Name}},"running":{{json .State.Running}},"pid":{{json .State.Pid}},"restart":{{json .HostConfig.RestartPolicy}},"ports":{{json .NetworkSettings.Ports}}}'
        if code==0:
            for identity in ids.split():
                rc,metadata=run(['docker','inspect','--format',template,identity])
                if rc==0: result['containers'].append(json.loads(metadata))
            rc,stats=run(['docker','stats','--no-stream','--format','{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}'])
            if rc==0: result['dockerStats']=stats.splitlines()
    except (OSError,ValueError,subprocess.TimeoutExpired):
        result['dockerInspection']='UNAVAILABLE'
    for unit in sorted(units):
        if not re.fullmatch(r'[a-zA-Z0-9_.@:\\-]+\.(service|socket)',unit): continue
        rc,state=run(['systemctl','show',unit,'--property=Id,LoadState,ActiveState,UnitFileState,Restart'])
        result['serviceStates'].append(dict(line.split('=',1) for line in state.splitlines() if '=' in line))
    result['warning']='No stop list approved. Unmanaged/session processes require an explicit restart method before stopping.'
    return result

if __name__=='__main__':
    print(json.dumps(discover(),indent=2))

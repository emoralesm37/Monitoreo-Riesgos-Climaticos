// Read-only resource gate. Never reads kubeconfig/.env or starts a cluster.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
function run(command, args) {
  return cp.execFileSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * MiB,
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function evaluate(snapshot) {
  // Operational margins for this lab, not official K3s minimum requirements.
  const blocks = [];
  if (snapshot.host.availableMiB < 2048) blocks.push('HOST_MEMORY_BELOW_2048_MIB');
  if (snapshot.docker.availableMiB < 4096) blocks.push('LINUX_VM_MEMORY_BELOW_4096_MIB');
  if (snapshot.host.diskFreeGiB < 15) blocks.push('HOST_DISK_BELOW_15_GIB');
  if (snapshot.docker.cpus < 2) blocks.push('FEWER_THAN_2_CPUS');
  return blocks;
}
function collect() {
  let host;
  if (process.platform === 'win32') {
    const script = String.raw`$labOs=Get-CimInstance Win32_OperatingSystem; $labMem=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; $labRoot=[IO.Path]::GetPathRoot((Get-Location).Path).Substring(0,1); $labDrive=Get-PSDrive -Name $labRoot; [pscustomobject]@{totalMiB=[math]::Round($labOs.TotalVisibleMemorySize/1024);availableMiB=$labMem.AvailableMBytes;committedPercent=$labMem.PercentCommittedBytesInUse;diskFreeGiB=[math]::Round($labDrive.Free/1GB,2)} | ConvertTo-Json -Compress`;
    host = JSON.parse(run('powershell.exe', ['-NoProfile', '-Command', script]));
  } else {
    const available = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m);
    const disk = fs.statfsSync(process.cwd());
    host = { availableMiB: Math.floor(Number(available[1]) / 1024), diskFreeGiB: Math.round(disk.bavail * disk.bsize / GiB) };
  }
  const engine = JSON.parse(run('docker', ['info', '--format', '{{json .}}']));
  const memory = run('docker', ['run', '--rm', '--network', 'none', '--read-only', '--memory', '64m', '--cap-drop', 'ALL',
    '--entrypoint', 'cat', 'climateguard/manifest-validation:review-20261106', '/proc/meminfo']);
  const available = memory.match(/^MemAvailable:\s+(\d+)/m);
  const cached = memory.match(/^Cached:\s+(\d+)/m);
  const tools = {};
  for (const tool of ['k3d', 'k3s', 'kind', 'kubectl']) {
    try { run(process.platform === 'win32' ? 'where.exe' : 'which', [tool]); tools[tool] = true; }
    catch { tools[tool] = false; }
  }
  const snapshot = { measuredAt: new Date().toISOString(), host,
    docker: { memoryMiB: Math.round(engine.MemTotal / MiB), availableMiB: Math.floor(Number(available[1]) / 1024),
      cachedMiB: Math.floor(Number(cached[1]) / 1024), cpus: engine.NCPU, architecture: engine.Architecture }, tools,
    runningContainers: run('docker', ['ps', '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}']).split('\n') };
  snapshot.resourceBlocks = evaluate(snapshot);
  snapshot.resourceDecision = snapshot.resourceBlocks.length ? 'BLOCKED_DO_NOT_CREATE_CLUSTER' : 'RESOURCES_PASS_RECHECK_TOOLS_AND_PINNED_VERSION';
  snapshot.thresholds = { hostAvailableMiB: 2048, linuxAvailableMiB: 4096, diskFreeGiB: 15, cpus: 2,
    rationale: 'Lab-only operational margins: capped 3-GiB server plus Linux headroom; preserve host responsiveness. Not vendor minimums.' };
  return snapshot;
}
if (require.main === module) {
  const snapshot = collect();
  const file = process.argv[2] || path.resolve('infrastructure/k8s/lab-minimal/preflight-result.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
  process.exitCode = snapshot.resourceBlocks.length ? 2 : 0;
}
module.exports = { evaluate };

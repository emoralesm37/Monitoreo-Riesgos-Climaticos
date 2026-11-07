#!/bin/sh
# Run only on the AWS-verified current IP of i-REPLACE_INSTANCE_ID.
# No installation, service start/stop, credential/config reads or database queries.
set -u
printf '\nUTC\n'
date -u
printf '\nArchitecture / CPUs\n'
uname -m
getconf _NPROCESSORS_ONLN
printf '\nMemory\n'
free -m
awk '/^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree):/' /proc/meminfo
printf '\nDisks / mounts\n'
df -hT
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS
findmnt -T / -o SOURCE,TARGET,FSTYPE,OPTIONS
printf '\nListening TCP ports\n'
ss -lnt
printf '\nService states (not changed)\n'
for cg_service in docker containerd nginx apache2 k3s; do
  printf '%s: ' "$cg_service"
  systemctl is-active "$cg_service" 2>/dev/null || true
  systemctl is-enabled "$cg_service" 2>/dev/null || true
done
printf '\nInstalled tools\n'
for cg_tool in docker k3s kubectl python3 curl sha256sum systemd-analyze; do
  command -v "$cg_tool" || true
done
if command -v docker >/dev/null 2>&1; then
  printf '\nExisting Docker inventory, NO environment values\n'
  sudo -n docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}' || true
  sudo -n docker volume ls --format '{{.Name}}|{{.Driver}}' || true
  sudo -n docker system df || true
  sudo -n docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}' || true
fi
printf '\nKnown candidate paths: existence only, no contents\n'
for cg_path in /srv/climateguard-demo /srv/climateguard-v2 /etc/rancher/k3s /var/lib/rancher/k3s; do
  if sudo -n test -e "$cg_path"; then printf 'EXISTS %s\n' "$cg_path"; else printf 'ABSENT_OR_NOT_ACCESSIBLE %s\n' "$cg_path"; fi
done
printf '\nRead-only diagnostic completed; no databases queried or services changed.\n'

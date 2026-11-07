#!/bin/bash
# NOT EXECUTED. Requires the user's approval of CUTOVER-20261106.md first.
# Stops only identified legacy resources; never deletes data, volumes or containers.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root after approval'; exit 2; }
[[ "${CG_APPROVED_CUTOVER_INSTANCE:-}" == i-REPLACE_INSTANCE_ID ]] || { echo 'Explicit approved-instance acknowledgement required'; exit 2; }
state=/var/lib/climateguard-demo-cutover
[[ ! -e "$state" ]] || { echo 'Existing cutover state found; review before retrying'; exit 2; }
units=(certbot.timer nginx.service climateguard-gateway.service climateguard-sensor.service climateguard-api.service climateguard-auth.service)
pg=b46a2de3a3e5363350579055bca4a815b377bd1e4d34237e504b483383d6604d
sql=bef15688c21fad123e62d50f283da068987a6fb1abf45e6066c6897c124155e4
[[ "$(docker inspect --format '{{.Name}} {{.State.Running}} {{.HostConfig.RestartPolicy.Name}}' "$pg")" == '/climateguard-auth-postgres true unless-stopped' ]] || { echo 'PostgreSQL identity/state changed'; exit 2; }
[[ "$(docker inspect --format '{{.Name}} {{.State.Running}} {{.HostConfig.RestartPolicy.Name}}' "$sql")" == '/climateguard-sqlserver true unless-stopped' ]] || { echo 'SQL identity/state changed'; exit 2; }
for unit in "${units[@]}"; do
  [[ "$(systemctl show "$unit" --property=LoadState --value)" == loaded ]] || { echo "Unknown unit: $unit"; exit 2; }
done
if systemctl is-active --quiet certbot.service; then echo 'Certificate renewal in progress; wait and review'; exit 2; fi
install -d -m 700 "$state"
date -u +%FT%TZ > "$state/started-utc.txt"
for unit in "${units[@]}"; do
  systemctl show "$unit" --property=Id,ActiveState,UnitFileState >> "$state/original-unit-states.txt"
done
printf '%s\n%s\n' "$pg" "$sql" > "$state/legacy-container-ids.txt"
# Enter the approved maintenance window before stopping application writers.
systemctl stop certbot.timer nginx.service
systemctl stop climateguard-gateway.service climateguard-sensor.service climateguard-api.service climateguard-auth.service
# unless-stopped already preserves this manual stop across Docker/host restarts.
docker stop --time 60 "$sql" "$pg"
systemctl disable "${units[@]}"
for unit in "${units[@]}"; do
  if systemctl is-active --quiet "$unit"; then echo "Still active: $unit"; exit 1; fi
done
if ss -H -lnt | awk '{n=split($4,a,":"); print a[n]}' | grep -Eq '^(80|443|5147|7101|7102|7000|1433|5433)$'; then
  echo 'A required legacy port remains occupied; refusing further action'; exit 1
fi
free -m
df -hT /
echo 'Approved legacy services stopped; Docker/containerd and all existing data retained. K3s NOT installed or started by this script.'

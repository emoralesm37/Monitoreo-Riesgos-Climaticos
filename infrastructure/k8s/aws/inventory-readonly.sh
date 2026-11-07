#!/bin/sh
# Run explicitly on the identified EC2 through an existing approved SSH/SSM session.
# No dotenv, docker inspect, process command lines, credentials, DB queries or writes.
set -eu
date -u
uname -m
getconf _NPROCESSORS_ONLN
free -m
df -hT
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS
ss -lnt
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}'
  docker volume ls --format '{{.Name}}|{{.Driver}}'
  docker system df
fi
for service in nginx apache2 httpd docker k3s; do
  systemctl is-active "$service" || true
done

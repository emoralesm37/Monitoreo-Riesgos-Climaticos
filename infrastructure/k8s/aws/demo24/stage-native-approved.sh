#!/bin/bash
# NOT EXECUTED. Installs files/unit only after explicit approval; DOES NOT START K3s.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Root required'; exit 2; }
[[ "${CG_APPROVED_CUTOVER_INSTANCE:-}" == i-REPLACE_INSTANCE_ID ]] || { echo 'Explicit approval acknowledgement required'; exit 2; }
[[ $(uname -m) == x86_64 ]] || { echo 'Expected x86-64'; exit 2; }
[[ ! -e /usr/local/bin/k3s && ! -e /etc/rancher/k3s && ! -e /srv/climateguard-demo ]] || { echo 'Existing K3s/demo files found; refusing replacement'; exit 2; }
if ss -H -lnt | awk '{n=split($4,a,":"); print a[n]}' | grep -Eq '^(80|443|6443)$'; then echo 'Required port occupied'; exit 2; fi
available_kib=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
free_kib=$(df -Pk / | awk 'NR==2{print $4}')
(( available_kib >= 6291456 )) || { echo 'Less than 6 GiB available after approved cutover; stop and review'; exit 2; }
(( free_kib >= 41943040 )) || { echo 'Less than 40 GiB free; no disk changes will be attempted'; exit 2; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ -f "$source_dir/candidate/k3s-config.yaml" && -f "$source_dir/native-artifacts.json" ]] || { echo 'Reviewed files missing'; exit 2; }
install -d -m 700 /srv/climateguard-demo/stage
stage=/srv/climateguard-demo/stage
curl --fail --location --proto '=https' --tlsv1.2 'https://github.com/k3s-io/k3s/releases/download/v1.37.2%2Bk3s1/k3s' -o "$stage/k3s"
printf '%s  %s\n' '265b3ee6a3198ef14033c63ef46cbb32370d83795199fb6d1b01f21575eddbda' "$stage/k3s" | sha256sum --check --status
curl --fail --location --proto '=https' --tlsv1.2 'https://raw.githubusercontent.com/k3s-io/k3s/v1.37.2%2Bk3s1/install.sh' -o "$stage/install.sh"
printf '%s  %s\n' 'ed01f89fd977bf20ac1516bbebf8370bf3ddbaa55dac8aba610956a4c78cc00b' "$stage/install.sh" | sha256sum --check --status
# Abort before copying a CRLF/BOM configuration to Linux.
python3 - "$source_dir/candidate/k3s-config.yaml" <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1]).read_bytes()
if b'\r' in p or p.startswith(b'\xef\xbb\xbf'): raise SystemExit('Configuration must be UTF-8 without BOM and LF only')
PY
install -m 755 "$stage/k3s" /usr/local/bin/k3s
install -D -m 600 "$source_dir/candidate/k3s-config.yaml" /etc/rancher/k3s/config.yaml
INSTALL_K3S_SKIP_DOWNLOAD=true INSTALL_K3S_SKIP_START=true INSTALL_K3S_SKIP_ENABLE=true INSTALL_K3S_SYMLINK=skip sh "$stage/install.sh" server
if systemctl is-active --quiet k3s.service; then echo 'Unexpected automatic start; inspect immediately'; exit 1; fi
echo 'Pinned K3s files staged. Service not started or enabled. Separate reviewed start step required.'

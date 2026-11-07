#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -r "$ENV_FILE" ]]; then
  printf '%s\n' 'Falta infrastructure/mongodb/.env; consulta README.local.md.' >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# Validate names only; never print credentials or enable shell tracing.
for variable in MONGO_REPORT_USERNAME MONGO_REPORT_PASSWORD MONGO_AUDIT_USERNAME MONGO_AUDIT_PASSWORD; do
  if [[ -z "${!variable:-}" ]]; then
    printf 'Falta la variable %s en el entorno local.\n' "$variable" >&2
    exit 1
  fi
done

docker exec \
  -e MONGO_REPORT_USERNAME \
  -e MONGO_REPORT_PASSWORD \
  -e MONGO_AUDIT_USERNAME \
  -e MONGO_AUDIT_PASSWORD \
  climateguard-mongodb sh -c '
    mongosh --quiet \
      --username "$MONGO_INITDB_ROOT_USERNAME" \
      --password "$MONGO_INITDB_ROOT_PASSWORD" \
      --authenticationDatabase admin \
      --eval "
        const reports = db.getSiblingDB(\"ClimateGuardReports\");
        const audit = db.getSiblingDB(\"ClimateGuardAudit\");

        if (!reports.getUser(process.env.MONGO_REPORT_USERNAME)) {
          reports.createUser({
          user: process.env.MONGO_REPORT_USERNAME,
          pwd: process.env.MONGO_REPORT_PASSWORD,
          roles: [{ role: \"readWrite\", db: \"ClimateGuardReports\" }]
          });
          print(\"Usuario de reportes creado\");
        } else {
          print(\"Usuario de reportes existente; sin cambios\");
        }

        if (!audit.getUser(process.env.MONGO_AUDIT_USERNAME)) {
          audit.createUser({
          user: process.env.MONGO_AUDIT_USERNAME,
          pwd: process.env.MONGO_AUDIT_PASSWORD,
          roles: [{ role: \"readWrite\", db: \"ClimateGuardAudit\" }]
          });
          print(\"Usuario de auditoria creado\");
        } else {
          print(\"Usuario de auditoria existente; sin cambios\");
        }

        print(\"Verificacion de usuarios completada\");
      "
  '

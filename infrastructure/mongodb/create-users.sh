#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="infrastructure/mongodb/.env"

set -a
source "$ENV_FILE"
set +a

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

        reports.createUser({
          user: process.env.MONGO_REPORT_USERNAME,
          pwd: process.env.MONGO_REPORT_PASSWORD,
          roles: [{ role: \"readWrite\", db: \"ClimateGuardReports\" }]
        });

        audit.createUser({
          user: process.env.MONGO_AUDIT_USERNAME,
          pwd: process.env.MONGO_AUDIT_PASSWORD,
          roles: [{ role: \"readWrite\", db: \"ClimateGuardAudit\" }]
        });

        print(\"Usuarios creados correctamente\");
      "
  '

#!/bin/bash
# Explicit one-off job, only against the NEW namespace SQL instance.
# Passwords travel through env/SQLCMD substitution, never CLI arguments or output.
set -euo pipefail
[[ "${CG_SQL_APP_USER:-}" =~ ^[a-z][a-z0-9_]{2,40}$ ]] || exit 2
# Fresh credentials must use this alphabet; excludes SQL quoting/substitution syntax.
[[ "${CG_SQL_APP_PASSWORD:-}" =~ ^[A-Za-z0-9_!@#%+-]{32,128}$ ]] || exit 2
export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
if ! /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -C -b -i /bootstrap/sql-app.sql -o /dev/null >/dev/null 2>&1; then
  echo 'SQL application provisioning failed; inspect privately. No existing identity was rotated.' >&2
  exit 1
fi
echo 'New SQL application identity provisioned; no server administrator role assigned.'

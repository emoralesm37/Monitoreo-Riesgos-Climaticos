#!/bin/bash

set -e

SQLCMD="/opt/mssql-tools18/bin/sqlcmd"

SERVER="sqlserver"
USER="sa"

echo "=================================================="
echo " ClimateGuard - Inicializacion de Base de Datos"
echo "=================================================="

echo "[1/4] Verificando disponibilidad de SQL Server..."

until "$SQLCMD" \
    -S "$SERVER" \
    -U "$USER" \
    -P "$MSSQL_SA_PASSWORD" \
    -C \
    -Q "SELECT 1" \
    -b \
    -o /dev/null
do
    echo "SQL Server aun no esta disponible. Reintentando..."
    sleep 5
done

echo "SQL Server disponible."


echo "[2/4] Verificando si ClimateGuard ya fue inicializada..."

DATABASE_INITIALIZED=$(
    "$SQLCMD" \
        -S "$SERVER" \
        -U "$USER" \
        -P "$MSSQL_SA_PASSWORD" \
        -C \
        -h -1 \
        -W \
        -Q "
            SET NOCOUNT ON;

            IF DB_ID(N'ClimateGuard') IS NOT NULL
               AND OBJECT_ID(N'ClimateGuard.dbo.Roles', N'U') IS NOT NULL
               AND OBJECT_ID(N'ClimateGuard.dbo.Sensors', N'U') IS NOT NULL
               AND OBJECT_ID(N'ClimateGuard.dbo.Alerts', N'U') IS NOT NULL
            BEGIN
                SELECT 1;
            END
            ELSE
            BEGIN
                SELECT 0;
            END
        "
)

DATABASE_INITIALIZED=$(echo "$DATABASE_INITIALIZED" | tr -d '[:space:]')


if [ "$DATABASE_INITIALIZED" = "1" ]; then

    echo "La base de datos ClimateGuard ya esta inicializada."
    echo "No se volvera a ejecutar ClimateGuard.sql."

else

    echo "[3/4] Ejecutando ClimateGuard.sql..."

    "$SQLCMD" \
        -S "$SERVER" \
        -U "$USER" \
        -P "$MSSQL_SA_PASSWORD" \
        -C \
        -b \
        -i /scripts/ClimateGuard.sql

    echo "Script ejecutado correctamente."

fi


echo "[4/4] Verificando base de datos..."

"$SQLCMD" \
    -S "$SERVER" \
    -U "$USER" \
    -P "$MSSQL_SA_PASSWORD" \
    -C \
    -b \
    -Q "
        USE ClimateGuard;

        SELECT
            DB_NAME() AS DatabaseName,
            COUNT(*) AS TableCount
        FROM sys.tables;
    "

echo "=================================================="
echo " ClimateGuard inicializada correctamente"
echo "=================================================="
# MongoDB local para Report Service

Preparación únicamente: estos pasos no se ejecutan automáticamente. No apuntar
a AWS ni usar credenciales o bases de producción.

## Configuración requerida

| Consumidor | Variables |
| --- | --- |
| Compose | `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` (se convierten en `MONGO_INITDB_ROOT_*` dentro del contenedor) |
| create-users.sh | `MONGO_REPORT_USERNAME`, `MONGO_REPORT_PASSWORD`, `MONGO_AUDIT_USERNAME`, `MONGO_AUDIT_PASSWORD` |
| Report Service: MongoDB | `MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_REPORT_USERNAME`, `MONGO_REPORT_PASSWORD` |
| Report Service: JWT y comunidades | `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `COMMUNITY_SERVICE_URL` |

El escenario actual usa MongoDB 7, `127.0.0.1:27017`, base
`ClimateGuardReports` y contenedor `climateguard-mongodb`. El script crea también
un usuario `readWrite` para `ClimateGuardAudit`, conservando su comportamiento
anterior. No implica que exista un Audit Service integrado.
El puerto está publicado exclusivamente en loopback.

`app/config.py` de Report Service lee primero este `.env` y después el `.env`
de la raíz: **la raíz tiene prioridad** cuando repite variables. Las variables
del proceso tienen prioridad sobre ambos archivos. Revisar destinos localmente
sin imprimir contraseñas, tokens ni cadenas de conexión. No importar la aplicación
para validar Compose. El cliente añade `/api/communities` a `COMMUNITY_SERVICE_URL`;
el ejemplo utiliza el Gateway local, sin duplicar `/api`.

## Crear el archivo local sin sobrescribir trabajo

Desde la raíz del repositorio, en PowerShell:

```powershell
$target = Join-Path (Get-Location) 'infrastructure/mongodb/.env'
if (Test-Path -LiteralPath $target) {
    Write-Host 'Ya existe .env; conservar y revisar localmente.'
} else {
    [System.IO.File]::Copy((Join-Path (Get-Location) 'infrastructure/mongodb/.env.example'), $target, $false)
}
git check-ignore -v infrastructure/mongodb/.env
```

Editar el archivo en un editor local. Sustituir todos los `REPLACE_WITH_*` por
valores exclusivos de desarrollo; para JWT deben coincidir con Auth/Gateway
locales. No pegar credenciales en consola, capturas o Git. Mantener asignaciones
compatibles con dotenv y Bash, LF/UTF-8 sin BOM; usar comillas simples si hay
caracteres especiales y evitar expresiones de shell: el script carga el archivo
con `source`. `.env` ya está excluido por el `.gitignore` general.

## Validar sin iniciar Docker ni mostrar valores

```powershell
docker compose --env-file infrastructure/mongodb/.env.example -f infrastructure/mongodb/docker-compose.yml config --quiet
```

Para comprobar posteriormente el `.env` real, sustituir la ruta de ejemplo y
conservar `--quiet`. No ejecutar `config` sin esa opción: imprimiría credenciales
interpoladas. Este comando valida la configuración sin conectarse al daemon.

En Git Bash, desde la raíz:

```bash
bash -n infrastructure/mongodb/create-users.sh
```

## Arranque posterior, solo cuando se autorice

Antes de arrancar, comprobar que el puerto, el nombre fijo del contenedor y el
volumen nombrado `climateguard-mongodb-data` no pertenecen a otra instalación.
Si existe un volumen con datos, detener la preparación y confirmar su procedencia:
no eliminarlo ni reinicializarlo. Las credenciales root de Compose solo inicializan
un volumen nuevo; cambiarlas en `.env` no cambia las de un volumen existente.

```powershell
docker compose --env-file infrastructure/mongodb/.env -f infrastructure/mongodb/docker-compose.yml config --quiet
docker compose --env-file infrastructure/mongodb/.env -f infrastructure/mongodb/docker-compose.yml up -d mongodb
docker compose --env-file infrastructure/mongodb/.env -f infrastructure/mongodb/docker-compose.yml ps
```

Esperar estado healthy. Después, en Git Bash:

```bash
bash infrastructure/mongodb/create-users.sh
```

El script localiza `.env` junto a sí mismo, independientemente del directorio de
ejecución. Comprueba cada usuario en su base antes de crearlo. Si ya existe,
lo conserva: **no rota contraseñas ni cambia roles**. Por tanto, que el script
termine correctamente no confirma que una contraseña nueva coincida con la
existente; validar luego autenticación y permisos desde Report Service. No
ejecutar simultáneamente varias instancias del script.

La comprobación posterior de Report Service es `/health/database`, y luego
`GET /api/reports/history?limit=50` mediante Gateway con JWT de Administrador.
Generar PDF requiere además API de comunidades y las dependencias nativas de
WeasyPrint. Este procedimiento no inicia Report Service ni ejecuta migraciones.
No usar `docker compose down -v`, eliminar volúmenes ni recrear bases.

# Report Service en Docker Desktop (Windows)

Imagen construida y servicio iniciado localmente. No modifica MongoDB,
sus usuarios ni su volumen, y no necesita libgobject instalado en Windows.

`JWT_ACCESS_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE` fueron sincronizados en el
`.env` de MongoDB desde la configuracion local de Auth. Antes de escribir se
verifico un JWT de diagnostico contra Auth (`/roles`) y Gateway
(`/gateway/session`): ambos respondieron 200. No se genero otra clave ni se
modificaron otras variables. Es un token de diagnostico, no una prueba de login
interactivo de usuario. No se guardan tokens en este documento ni en archivos.

## Configuracion

- Imagen base Python 3.12 / Debian Bookworm. Se conservan los rangos existentes
  de `requirements.txt`; no hay lock, por lo que la resolucion exacta de versiones
  se confirmara al construir. Incluye Pango, Cairo, GLib/GObject, HarfBuzz, codecs
  y fuentes DejaVu/Liberation (sustitucion de Arial de la plantilla).
- Puerto publicado solo `127.0.0.1:8000`; Uvicorn escucha `0.0.0.0` dentro del
  contenedor. El Gateway de Windows puede seguir utilizando su destino actual.
- Red externa existente `climateguard-mongodb-network`. MongoDB se resuelve como
  `climateguard-mongodb:27017`, nunca como localhost del contenedor. La base queda
  fijada a `ClimateGuardReports`, que coincide con el rol del usuario existente.
- Compose toma solo las variables report/JWT necesarias del `.env` indicado:
  `MONGO_REPORT_USERNAME`, `MONGO_REPORT_PASSWORD`, `JWT_ACCESS_SECRET`,
  `JWT_ISSUER`, `JWT_AUDIENCE`. No pasa credenciales root ni audit, ni copia/monta
  `.env` dentro de la imagen. Variables de la terminal con esos nombres tienen
  prioridad: comprobar privadamente que no sobreescriban la configuracion local.
- `COMMUNITY_SERVICE_URL` se fija para este escenario a
  `http://host.docker.internal:5147`; el cliente agrega `/api/communities`.
  No se reutiliza `http://localhost:5147` del `.env`, porque en Docker apuntaria
  al propio contenedor. No se modifica el `.env` original.
- JWT usa HS256, issuer/audience y claim literal `role=Administrador`. Los valores
  deben coincidir con Auth/Gateway locales; no basta que no esten vacios.
- Usuario Linux sin privilegios. PDFs en el volumen nombrado
  `climateguard-report-pdfs-local`, montado sobre `app/generated` con la misma
  ruta usada al generar y descargar. MongoDB conserva la metadata separadamente.
  PDFs antiguos guardados en Windows no se copian al volumen automaticamente.
- El contexto de build es exclusivamente este servicio. `.dockerignore` excluye
  el entorno virtual, archivos dotenv, PDFs, caches y claves comunes.

La configuracion Python conserva su estructura de directorios y recibe valores
del entorno del proceso. Los `.env` del host no se leen dentro del contenedor.
El healthcheck verifica `/health`; **no garantiza MongoDB, JWT ni generacion PDF**.

## Comandos PowerShell desde la raiz del repositorio

Ejecutar solamente despues de aprobar el arranque:

```powershell
Set-Location C:\Users\USER\Desktop\Gerardo\ClimateGuard
docker compose --env-file infrastructure/mongodb/.env -f services/report-service/docker-compose.local.yml config --quiet
docker compose --env-file infrastructure/mongodb/.env -f services/report-service/docker-compose.local.yml build report-service
docker compose --env-file infrastructure/mongodb/.env -f services/report-service/docker-compose.local.yml up -d --no-deps report-service
docker compose --env-file infrastructure/mongodb/.env -f services/report-service/docker-compose.local.yml ps
```

No usar `config` sin `--quiet` ni imprimir `docker inspect` completo: contienen
credenciales. Este Compose no declara MongoDB y no lo inicia ni recrea.
No usar comandos que borren volumenes. Reservar el puerto 8000 antes de iniciar.

## Comprobacion posterior de conectividad y PDF real

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/health/database
docker compose --env-file infrastructure/mongodb/.env -f services/report-service/docker-compose.local.yml exec -T report-service python -c "import urllib.request; print(urllib.request.urlopen('http://host.docker.internal:5147/health', timeout=5).status)"
```

El Gateway actual anuncia `localhost:5147`. La accesibilidad desde Docker Desktop
debe comprobarse al arrancar: depende del enlace del proceso y firewall de Windows.
Si falla, no cambiar destinos a produccion ni abrir puertos publicos. Revisar
primero el enlace del Gateway; una escucha en la interfaz accesible por Docker
con reglas de firewall locales puede requerir autorizacion aparte. Esta tarea
no modifica Gateway ni firewall.

Con Gateway en Development, Auth y comunidades disponibles, iniciar sesion como
Administrador en Angular y abrir `http://localhost:4200/reportes`. Generar un
reporte: debe responder `POST /api/reports/communities` con `report_id`, aparecer
en `GET /api/reports/history?limit=50` y descargarse como PDF desde
`GET /api/reports/{report_id}/download`. Confirmar encabezado `%PDF-`, contenido
de comunidades y metadata persistida; luego comprobar que el archivo permanece
tras una recreacion autorizada del servicio sin borrar su volumen.

Un 401/403 indica JWT/rol; `/health/database` 503 indica conexion/credenciales
MongoDB; generacion 502 indica consulta fallida a comunidades. Que el contenedor
arranque no demuestra el recorrido completo. No pegar tokens en comandos,
historial ni logs; usar la sesion Angular y su interceptor existente.

## Resultados de la ejecucion local

- Imagen construida con Python 3.12.16 y WeasyPrint 69.0.
- `/health` y `/health/database`: HTTP 200; conexion real al MongoDB local.
- `/api/reports/admin-check` y `/api/reports/history?limit=50`: HTTP 200 con
  JWT administrativo de diagnostico; el historial devolvio cero registros.
- Sin token: HTTP 401; rol VIEWER: HTTP 403.
- La plantilla real de comunidades genero un PDF de 10 207 bytes con cabecera
  `%PDF-`, usando un conjunto vacio como prueba tecnica. No se simulo una respuesta
  de comunidades ni se inserto metadata ficticia en el historial. El archivo
  quedo en el volumen de PDFs. Esto valida el motor nativo, no el flujo completo.
- Se corrigio la cache no escribible de Fontconfig mediante `XDG_CACHE_HOME`
  y un directorio del usuario sin privilegios en la imagen. Se reconstruyo y
  actualizo exclusivamente el nuevo Report Service: una segunda prueba produjo
  un PDF real de 6 049 bytes sin esos avisos. El primer PDF permanecio en el
  volumen despues de actualizar el contenedor. Estado final: running/healthy.
- Report Service llega a `/health` del Gateway de Windows: HTTP 200.
- Se resolvieron los anteriores 502/404: el Gateway estaba ejecutando una version
  anterior y el SQL Server local estaba detenido. Se compilo el Gateway actual
  y se reinicio solamente ese proceso. Se inicio `climateguard-sqlserver`
  conservando su volumen; la base `ClimateGuard` ya contenia dos comunidades.
- Para conservar el contrato Angular con `sensorCount`, se inicio el backend
  compartido de `backend/ClimateGuard.Api` en `127.0.0.1:7000`, destino existente
  `legacy-api`. No se sustituyo por Community Service independiente: este ultimo
  carece de conexion PostgreSQL configurada y su DTO no tiene `sensorCount`.
- El backend usa una conexion SQL local en variables de proceso con la credencial
  ya existente del contenedor, y el mismo JWT local de Auth. Se dejaron vacios
  `InitialAdmin:Name/Email/Password` en ese proceso para omitir el seeder. No se
  ejecutaron inicializaciones, migraciones ni inserciones de comunidades.
- El Gateway escucha `localhost:5147` con Development y content root del proyecto
  actual, cargando `appsettings.json` y `appsettings.Development.json`. No se
  cambiaron rutas ni destinos de Auth, sensores o alertas. Estos procesos .NET
  usan compilaciones aisladas en TEMP para no sobrescribir binarios anteriores.
- Prueba HTTP completa con JWT administrativo de diagnostico: Gateway comunidades
  200 (dos registros reales), report admin-check 200, roles 200, generacion POST
  200, historial 200 con `_id` y estado completed, descarga 200 application/pdf.
  PDF real: 10 858 bytes, cabecera `%PDF-`, generado con comunidades de SQL Server.
  Copia local en `%TEMP%/ClimateGuard-real-communities-report.pdf`.
- Compilacion Gateway sin advertencias; backend compartido compila con avisos
  preexistentes NU1902/NU1903 de System.Security.Cryptography.Pkcs 9.0.11.
  Las 28 pruebas aisladas de Gateway pasan; no sustituyen las pruebas HTTP reales.
- Se recupero el acceso de `admin@example.invalid` con autorizacion expresa:
  se confirmo PostgreSQL en loopback 5432 y la cuenta unica, activa y Administrador.
  Se actualizo exclusivamente su `password_hash` usando la libreria bcrypt de
  Auth, coste 12, con la clave de pruebas ya existente en la configuracion local
  `services/auth-service/.env` (`INITIAL_ADMIN_PASSWORD`). No se documenta su valor.
  La operacion fue transaccional y se verifico que los demas usuarios, hashes,
  roles y estados permanecieran intactos. No se crearon usuarios ni se cambio JWT.
- Login normal mediante `/api/auth/login`: HTTP 200, token emitido por Auth.
  Con ese JWT real, admin-check, comunidades, generacion, historial y descarga
  respondieron 200; PDF valido de 10 855 bytes. No se usaron tokens sinteticos.
- Prueba real en Chrome headless: login desde Angular, acceso a `/reportes`,
  historial visible, boton de generacion HTTP 200, nuevo registro visible y
  descarga Blob autenticada. PDF descargado de 10 791 bytes con cabecera `%PDF-`.
  Captura `%TEMP%/ClimateGuard-reportes-authenticated.png` y PDF
  `%TEMP%/ClimateGuard-angular-real-report.pdf`. Sin mocks de API ni sesiones
  inyectadas. No fue necesario corregir codigo frontend.

Fuentes de referencia:
- https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
- https://docs.docker.com/desktop/features/networking/networking-how-tos/

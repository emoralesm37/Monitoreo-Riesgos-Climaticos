# Auditoría centralizada local

Implementada y validada con los servicios locales reales. No contiene configuración ni despliegue de AWS.

## Recorrido y fuente de verdad

Angular → Gateway → Audit Service FastAPI → MongoDB `ClimateGuardAudit.events`.

El Gateway es el único productor de eventos para las operaciones HTTP que atraviesan sus rutas. Auth, Usuarios, Comunidades, Sensores, Alertas, Reportes y Reglas conservan sus autorizaciones y contratos. No se introdujeron llamadas de auditoría en cada servicio para evitar duplicar la misma operación o crear dependencias circulares. Audit Service verifica JWT localmente y no llama a Auth.

`AuditLogEntry` de SQL Server no se reutiliza: sus IDs de usuario son enteros y no corresponden a los UUID de Auth. No se modificaron sus tablas ni se migraron registros antiguos. No se encontró código activo que insertara esa entidad.

## Seguridad y contratos

- `GET /api/audit/events`: JWT HS256 válido de Auth, issuer/audience/exp/sub obligatorios y rol `Administrador`, tanto en Gateway como en Audit Service. Operador recibe 403.
- Parámetros: `page` (1–10000), `page_size` (1–100, defecto 25), `module`, `action`, `actor` (UUID exacto), `result`, `start` y `end` (ISO 8601 UTC). Devuelve `{items,total,page,page_size}`, ordenado por fecha descendente y UUID para desempatar.
- `POST /internal/events`: **no se publica en YARP**. Autenticación entre servicios mediante `X-Audit-Timestamp` y `X-Audit-Signature`, HMAC-SHA256 de `timestamp + '.' + cuerpo exacto`. Ventana de 60 segundos. Un JWT de usuario, incluso administrativo, no permite insertar eventos. Se usa una clave independiente de las claves JWT.
- `GET /health`: comprueba MongoDB. Puerto Docker publicado únicamente en `127.0.0.1:8001`.

Evento: `event_id` UUID, `occurred_at` UTC, `actor_id` UUID o null, `actor_name`, `actor_role`, `module`, `action`, `entity_id` o null, `result` y `http_status`. Módulo/acción/estado están limitados por esquema. Los únicos metadatos operativos son el código HTTP y el identificador de entidad; no se aceptan metadatos arbitrarios. El UUID del evento identifica la recepción, no sustituye la idempotencia de negocio.

El actor proviene del JWT validado por el Gateway. En un login exitoso se obtiene exclusivamente del usuario devuelto por Auth. Un login fallido queda anónimo, sin almacenar el correo intentado. Los fallos sin identidad verificable no se atribuyen a un usuario. No se guardan cuerpos de solicitudes/respuestas, contraseñas, hashes de contraseñas, tokens, firmas HMAC, cookies ni cadenas de consulta. La API no permite editar o eliminar eventos.

## Cola persistente y garantías

Development habilita `Audit:Enabled`. La cola se guarda fuera del repositorio en `%LOCALAPPDATA%/ClimateGuard/audit-outbox`, configurable con `Audit__OutboxDirectory`. No está dentro de un contenedor efímero.

1. Antes de reenviar una operación auditada se escribe una reserva `.pending` con UUID y resultado `UNKNOWN`, mediante escritura persistente y renombrado. Si falla la reserva, el Gateway devuelve 503 y no llama al servicio.
2. Tras responder el servicio se guarda `.ready`: 2xx → `CONFIRMED`, 4xx → `FAILED`, 5xx → `UNKNOWN` por posible resultado ambiguo. El Gateway no presenta un 2xx como éxito antes de recibirlo del servicio.
3. El worker reintenta cada 3 segundos (timeout de 5 segundos por envío). Solo elimina el archivo cuando Audit Service confirma recepción. No hay descarte por número de reintentos.
4. Reservas sin terminar durante más de 5 minutos se entregan como `UNKNOWN`; nunca se inventa un éxito. Una falla al guardar el resultado deja la reserva y genera un log crítico sin datos sensibles.
5. MongoDB tiene índice único `event_id` y comparación de los campos saneados del evento (fechas normalizadas a la precisión de milisegundos de BSON), sin almacenar hashes: reenviar el mismo evento devuelve `duplicate=true`; reutilizar el UUID con otro contenido devuelve 409. Los conflictos permanecen en cola para revisión, no se descartan.

Esto proporciona reintentos de entrega y deduplicación persistente de eventos, **no una transacción distribuida** entre la base de negocio y MongoDB. Una caída puede dejar el resultado no confirmado. Si se pierde físicamente el disco de la cola, no puede garantizarse recuperación. La cola no tiene purga automática: debe vigilarse el espacio y revisar advertencias de entrega. La clave de servicio y la carpeta de cola deben conservar permisos privados del usuario que ejecuta Gateway.

Cobertura: login/logout, altas y modificaciones de usuarios, comunidades, sensores y reglas, lecturas manuales, cambios de estado, reset de sensores, resolución de alertas y generación de reportes mediante Gateway. No se registran consultas de lectura ni refresh de tokens. No cubre operaciones directas contra servicios, jobs internos, evaluaciones automáticas de alertas ni cambios directos en bases. Cada solicitud HTTP independiente es un evento distinto, aunque repita una operación de negocio. Un productor interno futuro requiere su propio contrato de identidad e idempotencia; no debe reutilizar ciegamente los eventos del Gateway.

## Configuración y arranque desde la raíz

MongoDB existente y su red `climateguard-mongodb-network` deben estar disponibles. Se reutilizan `MONGO_AUDIT_USERNAME` y `MONGO_AUDIT_PASSWORD` del archivo ignorado `infrastructure/mongodb/.env`, con `authSource=ClimateGuardAudit`. No se entregan credenciales root ni de Report Service al nuevo contenedor.

Variables adicionales: `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` ya deben coincidir con Auth; `AUDIT_INGEST_KEY` es una clave local independiente. `configure-local.cjs` genera esta última solamente si no existe y la configura privadamente en los User Secrets del Gateway. No reemplaza contraseñas ni claves existentes. No ejecutar `docker compose config` sin `--quiet`, porque puede imprimir valores resueltos.

```powershell
node services/audit-service/configure-local.cjs
docker compose --env-file infrastructure/mongodb/.env -f services/audit-service/docker-compose.local.yml config --quiet
docker compose --env-file infrastructure/mongodb/.env -f services/audit-service/docker-compose.local.yml up -d --build --no-deps audit-service
```

Gateway Development usa `Audit:IngestUrl=http://127.0.0.1:8001/internal/events`, `Audit:SigningKey` privado y destino YARP `audit-service=http://127.0.0.1:8001/`. Se reinicia el Gateway después de cambiar su código; conservar sus variables JWT locales. No se cambió la configuración de Production. Una instalación nueva necesita las dependencias Node existentes de Auth para el script de preparación.

## Angular

Abrir `http://localhost:4200/historial` como Administrador. Incluye filtros, paginación, detalle, estado vacío, error/reintento y fechas locales (convertidas a UTC en las consultas). No utiliza localStorage ni eventos precargados. Se conservó el historial real de alertas resueltas en `/historial-alertas`, con acceso autenticado como antes.

## Evidencia real del 2026-11-05, horario Guatemala

Se validaron JWT reales de Administrador y Operador: consulta 200/403, sin token 401; POST público 405 y recepción interna con solo JWT 401. Se detuvo únicamente el nuevo Audit Service: crear un usuario devolvió 201, el evento quedó en disco y se entregó al reiniciarlo. Repetir el cuerpo real firmado devolvió 200 con `duplicate=true`; después de otro reinicio había exactamente un evento con ese UUID.

Recursos locales claramente identificados, conservados sin borrar:

- Usuario `prueba.auditoria.local@climateguard.test`, UUID `e9bba90b-e3d2-4998-8f6a-963026a00e18`, Operador, desactivado al finalizar. Su contraseña aleatoria solo existió en memoria. Todos los usuarios anteriores permanecieron idénticos, incluidos roles y hashes.
- Comunidad 1002, sensor 3 y regla 2: nombres `PRUEBA LOCAL AUDITORIA`, sin geolocalización inventada; quedaron desactivados.
- Lectura manual de prueba 100, sin hardware; produjo alerta real 5, luego resuelta mediante PATCH 200. Sus operaciones generaron eventos reales.
- Reporte `6aed3c35d2863ba8eb4b36ab`: generación 200 y PDF válido descargado con 12013 bytes.
- Evento de creación de usuario `19a7ca66-390e-4d09-b598-08872fe7d9c1`: persistió y no se duplicó al reenviarlo.

Se encontraron eventos confirmados de los siete módulos, y un intento administrativo 403 atribuido al Operador. Se verificó que los eventos no contuvieran los tokens, contraseñas y clave de servicio utilizados en la prueba. No se fabricaron eventos para demostrar el recorrido real.

Chrome automatizado: login real, tabla, filtro por módulo, detalle, persistencia al recargar y ancho de 390 px sin desbordamiento de página. Capturas en `%TEMP%/ClimateGuard-audit-desktop.png` y `%TEMP%/ClimateGuard-audit-mobile.png`. Sensores, Usuarios, Alertas, Comunidades, Reportes y alertas resueltas mantuvieron navegación y APIs reales; no se repitieron exhaustivamente todos sus CRUD.

Pruebas aisladas: Angular 91, Gateway 37, Audit Service 10 aprobadas. Los dobles de pruebas se limitan a esas suites; no sustituyen la evidencia HTTP/PostgreSQL/MongoDB anterior. Build Angular y Gateway, imagen Docker y validación Compose aprobados. La advertencia CommonJS de Leaflet ya existía.

La prueba destructiva de pérdida física del disco no se realiza. No se ha validado ni desplegado esta integración en AWS.

`tests/validate-local.cjs` documenta y ejecuta la prueba de escritura local. Es explícita, no forma parte de pytest y rechaza duplicar la cuenta de prueba si ya existe; no volver a ejecutarla sin revisar los recursos existentes.

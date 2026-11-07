# Alertas integradas localmente

## Fuente de verdad y ruta unica

Alert Service Java/PostgreSQL es propietario de las alertas y su estado.
Las reglas se administran en SQL Server con el contrato existente de Angular.
Java obtiene una instantanea de reglas activas al evaluar por primera vez una
lectura, desde GET `/api/alert-rules/evaluation` del Gateway. Ese contrato de solo
lectura admite Administrador/Operador; el CRUD administrativo original sigue
restringido a Administrador. No hay conversion de unidades ni umbrales ocultos.

La ruta activa es:

`lectura manual -> Sensor Service compartido -> SQL (lectura + entrega) -> Gateway -> Java -> PostgreSQL -> Angular`.

Se retiraron las llamadas y registros DI del motor SQL y los umbrales fijos del
servicio Java. No se consultan ni escriben alertas nuevas en dbo.Alerts.
La tabla historica se conserva sin borrados. El antiguo contenedor de pruebas
Java `cg-alertval-a60ba22-alerts-1` quedo detenido, sin eliminarlo ni borrar su DB.

## Contrato y fallos

POST `/api/alerts/evaluate` ahora exige `measurementId`, `sensorId`,
`sensorTypeId`, `sensorName`, `readingType`, `unit`, `communityId`, `communityName`,
`value` y `capturedAt` UTC. El antiguo cuerpo sin identificador no permite una
deduplicacion segura: devuelve 400 en lugar de usar umbrales fijos.

El productor genera `sqlserver:ClimateGuard:reading:{SensorReadingId}` despues
de obtener el ID persistido. No inventa una lectura fisica. Datos y nombres
proceden de las relaciones reales del sensor; la fecha manual se captura en UTC.
Para hardware futuro, ese ID de lectura no sustituye una futura deduplicacion
de mensajes en la entrada del puente serial: volver a POSTear un valor manual
crea otra lectura, mientras reenviar la misma lectura usa el endpoint de abajo.

SQL guarda lectura y sobre en una transaccion mediante ReadingAlertDeliveries.
El envio HTTP ocurre despues del commit. JWT del usuario se propaga en memoria,
no se persiste. Si falla la entrega, la API conserva la lectura y devuelve
`alertEvaluationPending=true`; su consulta tambien refleja el pendiente.
La pantalla Sensores muestra el estado y permite reintentar a los roles escritores.
No se implemento un worker autonomo ni se guarda un token de usuario para tareas
desatendidas. El reintento se hace con un JWT vigente:

- POST `/api/sensors/{sensorId}/readings/{readingId}/evaluate`.
- GET `/api/sensors/{sensorId}/readings/evaluation-status`.

Java usa recibos persistentes en reading_evaluations, bloqueo de fila y PK unica.
El hash de contenido impide reutilizar un ID con otra medicion (409). El recibo
y las alertas se confirman juntos; tambien se guarda el resultado sin alertas.
Hay ademas un indice unico por medicion/regla. Un insert concurrente en conflicto
devuelve 409 y permite reintentar el mismo sobre; no crea otra alerta. Reenviar
despues de resolver o reiniciar devuelve el resultado persistido, sin reabrir.
Los limites minimumValue/maximumValue son inclusivos; se incumple estrictamente
por debajo o por encima. Una regla inactiva o ausente no genera alertas.

## Configuracion local y migraciones

- Gateway mantiene el destino existente `localhost:7301`; no se cambio ninguna
  ruta de Auth, sensores, comunidades o reportes.
- Compose Java publica solo `127.0.0.1:7301`. Reutiliza PostgreSQL local existente
  en la red interna `cg-alertval-a60ba22_isolated`, sin publicar esa DB.
- Una segunda red bridge permite el puerto publicado y acceder al Gateway de
  Windows por host.docker.internal:5147; la red interna sola no lo permitia.
- JWT real de Auth: clave, issuer y audience ya existentes en .env de MongoDB,
  seleccionados por Compose sin pasar credenciales root/audit.
- `start-local.cjs` recupera las credenciales existentes del PostgreSQL local en
  memoria, las pasa solo al proceso hijo y no las imprime. No usarse con
  tracing o transcripcion. Desde PowerShell en la raiz: `node services/alert-service/start-local.cjs`.
  Agregar `--build` ejecuta tambien los tests Java dentro del build Docker.
- SQL: `database/updates/20261106_reading_alert_deliveries.local.sql`, solo tabla
  nueva y FK a SensorReadings. No cambia lecturas ni usa un baseline EF ficticio.
- Flyway V2: recibos y columnas nullable de procedencia en alerts; preserva los
  datos anteriores y agrega el indice unico. No se modifico V1 ni su checksum.
- Sensor y backend compartido requieren sus variables locales de conexion SQL
  y JWT como antes; Development configura Alerts:GatewayUrl a localhost:5147.
  Ambos deben usar las compilaciones nuevas. El modo independiente de sensores
  se conserva, pero su persistencia separada aun no produce estos sobres.

## Evidencia real (sin JWT sinteticos)

Se reutilizo el administrador existente y login normal. Se crearon solamente
regla y sensor marcados PRUEBA LOCAL; no se tocaron reglas de negocio.
Sensor 2, regla 1, rango 10..30, severidad ROJO, mensaje que identifica lectura
manual sin hardware. La prueba utiliza el fenomeno configurado en esa regla;
no representa un diagnostico fisico ni un riesgo real medido.

- Lectura 2, valor 45: alerta PostgreSQL 3, una sola alerta por lectura/regla.
- Reenvio y reinicio Java: sigue existiendo una sola alerta.
- Lectura 3, valor 20: cero alertas.
- Java detenido durante lectura 4, valor 50: lectura persistida y pendiente.
  Recuperacion y tres reintentos concurrentes: alerta 4 una sola vez, sin pendientes.
- Chrome: login real, filtros, detalle con procedencia/fecha/unidad, resolucion
  de alertas 3 y 4, recarga y listado RESUELTA persistente. Dashboard coincide
  con el conteo real de la API. No hay respuestas de negocio simuladas.
- Capturas: `%TEMP%/ClimateGuard-alerts-active.png` y
  `%TEMP%/ClimateGuard-alerts-resolved.png`.

## Pruebas

Dockerfile ejecuta mvn clean verify: pruebas Java con H2 y RuleProvider aislado
mediante Mockito (no confundir con las comprobaciones reales anteriores).
Cubren permisos, limites, lectura normal, regla ausente, unidad incompatible,
conflicto de contenido y reenvio tras resolucion. PostgreSQL real se comprobo
con HTTP concurrente y reinicio, no con una base simulada.
Angular mantiene estados de carga/error/vacio, filtros por estado/severidad/
sensor/fechas, detalle y resolucion conservando la tarjeta si falla. Dashboard
ya no consume las claves locales de alertas ni historial para sus metricas;
no se borro sessionStorage ni datos almacenados del usuario. La pantalla
Historial ahora consulta exclusivamente alertas RESUELTA de la misma API, sin
sembrar eventos ficticios ni usar localStorage. No se presenta como auditoria
administrativa: ese servicio no forma parte de esta implementacion.

Pruebas finales adicionales: reenvio de lectura 2 despues de resolver devuelve
200/duplicatePrevented=true y conserva RESUELTA; mismo ID con otro valor devuelve
409. Se desactivo exclusivamente la regla de prueba y la lectura 5 (valor 45)
no genero alerta. Se dejaron inactivos regla 1 y sensor 2, conservando evidencia.
Regresion real de Reportes: generacion y descarga 200, PDF valido de 10 923 bytes.

Resultado final: 14 pruebas Java (mvn clean verify dentro de Docker), 26 pruebas
Sensor Service y 50 pruebas Angular aprobadas; builds .NET y Angular correctos.
Persisten los avisos preexistentes de Pkcs y CommonJS/Leaflet. Captura movil en
`%TEMP%/ClimateGuard-alerts-mobile.png`: sin desbordamiento horizontal. Historial
real comprobado tambien en Chrome con las dos alertas resueltas de prueba.
Consulta directa final: dbo.Alerts conserva cero filas, cuatro sobres SQL sin
pendientes y cuatro recibos PostgreSQL procesados; solo lecturas 2 y 4 contienen
IDs de alerta (3 y 4), ambas RESUELTA. Lecturas 3 y 5 sin alertas.

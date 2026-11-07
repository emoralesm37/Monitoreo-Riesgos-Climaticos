# Validación real de Alert Service — 5 de noviembre de 2026

## Resultado y alcance

Alert Service real, Gateway real, Angular compilado en Chrome y PostgreSQL de
pruebas funcionaron conjuntamente. No se cambió de rama ni se integró código
backend: se exportó una copia temporal de `origin/feature/fase3-alert-rules`,
commit `54b9ef9118e49f3d7bb5c148f4a1fb8b8a7fc5c4`.

No hubo cambios de aplicación en frontend/Gateway durante esta validación.
No se accedió a AWS, no se eliminaron volúmenes ni se usaron bases existentes.
Todos los cambios de trabajo anteriores se conservaron.

## Requisitos descubiertos

- Dockerfile existente: Maven 3.9 con Java 17 para compilar; Java 17 JRE para
  ejecutar. `pom.xml` utiliza Spring Boot 4.1.2.
- PostgreSQL; para esta prueba se utilizó `postgres:17-alpine` (servidor 17.11).
- `SERVER_PORT` (por defecto 7301).
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
  `SPRING_DATASOURCE_PASSWORD`.
- `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, coherentes con el Gateway.
- Flyway se ejecuta al arrancar. La migración V1 crea exclusivamente la tabla
  alerts y sus índices; Hibernate usa `ddl-auto=validate`.
- Umbrales configurables mediante `ALERT_THRESHOLD_*`; se conservaron sus
  valores predeterminados para la prueba.

Se compararon las ramas `fase3-alert-service` y `fase3-alert-rules`: la segunda
añade evaluación, tipos de lectura, prevención de alertas activas repetidas y
pruebas. Se utilizó su Dockerfile sin modificarlo. No había un Compose dedicado
que levantara conjuntamente Alert Service y su base; se creó uno temporal.

## Aislamiento y archivos temporales

Directorio de prueba, fuera del repositorio:

`C:\Users\USER\AppData\Local\Temp\climateguard-alert-validation-a60ba220c3414198ad6d4d5464e8c76d`

- `source.tar` y `services/alert-service/`: exportación de Git.
- `compose.test.json`: proyecto `cg-alertval-a60ba22`.
- `test-identity.json`: identidad criptográfica temporal de pruebas; no
  publicar su contenido ni incorporarlo a Git.
- `validate.js`: peticiones HTTP y navegador Playwright.
- `results.json`: respuestas/status y aserciones de navegador, sin tokens.
- `gateway.log`: ejecución temporal del Gateway.

PostgreSQL usa una red interna sin puerto publicado y almacenamiento tmpfs
nuevo. Alert Service comparte esa red y una red bridge de acceso, publicando
solo `127.0.0.1:17301 → 7301`. Inicialmente la publicación no funcionó usando
únicamente la red interna en Docker Desktop; se añadió la segunda red solo al
servicio, conservando PostgreSQL intacto. No se borraron sus datos.

La migración V1 se aplicó únicamente en `alert_validation`, dentro de ese
PostgreSQL nuevo. Se comprobó `flyway_schema_history.success = true`.

## Comandos utilizados

Desde la raíz del repositorio, con `$testRoot` apuntando al directorio anterior:

```powershell
docker desktop start
git archive --format=tar --output="$testRoot\source.tar" origin/feature/fase3-alert-rules services/alert-service
tar -xf "$testRoot\source.tar" -C $testRoot
docker build -t climateguard-alert-validation:54b9ef9 "$testRoot\services\alert-service"
docker compose -f "$testRoot\compose.test.json" up -d db
docker compose -f "$testRoot\compose.test.json" up -d alerts
node "$testRoot\validate.js"
docker compose -f "$testRoot\compose.test.json" exec -T db psql -U alert_test -d alert_validation -c 'SELECT alert_id, sensor_id, status, trigger_value, resolved_by_user_id FROM alerts ORDER BY alert_id;'
```

El script genera JWT de prueba sin imprimirlos y arranca el Gateway compilado
con la configuración temporal. No ejecuta Auth Service: **login y refresh no
forman parte de esta validación**. Playwright se instaló solo en el directorio
temporal; no se cambiaron dependencias del proyecto.

## Respuestas reales

Se probaron directamente en Alert Service y mediante Gateway:

| Operación | Resultado |
|---|---|
| GET `/api/alerts?status=ACTIVA`, sin JWT | 401 |
| GET con JWT expirado o emisor incorrecto | 401 |
| GET con firma JWT incorrecta, directo | 401 |
| GET autorizado con base sin alertas activas | 200, `[]` |
| GET con `status=INVALID` | 400 |
| GET `/api/alerts/999999` | 404 |
| POST `/api/alerts/evaluate` con `{}` | 400 |
| POST evaluación con VIEWER | 403 |
| POST evaluación de nivel de río 1 | 200, sin alerta |
| POST evaluación de nivel de río 9 | 200, alerta generada |
| Repetir evaluación con alerta activa equivalente | 200, `duplicatePrevented=true` |
| PATCH resolución con VIEWER | 403; alerta permanece activa |
| PATCH resolución con ADMIN | 200; estado RESUELTA persistido |
| Repetir resolución | 409 |
| GET con `status=RESUELTA` | 200; contiene resolución persistida |
| `/actuator/health`, `/liveness`, `/readiness` bajo `/actuator/health` | 200, UP |

Se comprobaron escrituras con ADMIN, OPERATOR y Operador; VIEWER puede consultar
pero no evaluar ni resolver. El código también admite Administrador.

## Prueba real de navegador

Se sirvió el Angular compilado en `127.0.0.1:4200`, con un proxy local de pruebas
para `/api` hacia el Gateway real en `localhost:5147`, y este hacia el servicio
real en `127.0.0.1:17301`. No se simularon respuestas HTTP del backend.

La sesión Angular se sembró con identidad temporal de pruebas, sin realizar
login contra Auth. Para provocar un fallo real se mostró una acción de ADMIN
con JWT de VIEWER: el backend devolvió 403, apareció el error y la tarjeta se
conservó. Con sesión VIEWER la acción no se mostró. Con ADMIN real, PATCH 200
retiró la tarjeta y mostró confirmación y vacío. La consulta SQL verificó el
estado RESUELTA y `resolved_by_user_id=local-validation-user`.

El primer intento del script de navegador falló por un selector de texto exacto
que incluía una etiqueta adicional. Se corrigió solo ese selector temporal y
se repitió la prueba completa, aprobada. No fue un fallo de Angular.

## Cómo probarlo manualmente

Los contenedores de pruebas quedan ejecutándose; Gateway y servidor Angular
temporales se detienen al terminar la prueba automática. Para abrir una sesión
de navegador preparada sin copiar tokens:

```powershell
$testRoot = 'C:\Users\USER\AppData\Local\Temp\climateguard-alert-validation-a60ba220c3414198ad6d4d5464e8c76d'
node "$testRoot\validate.js" --headed
```

Requiere libres 4200 y 5147. El script repite la validación, crea una nueva
alerta identificada como prueba y abre Chrome en Alertas con sesión de pruebas.
Permite actualizar y resolver manualmente; cerrar el navegador finaliza sus
servidores temporales. No usar esta identidad ni esta configuración en AWS.

La base tmpfs es deliberadamente temporal: no asumir conservación después de
detener/recrear PostgreSQL. No se usaron ni eliminaron volúmenes existentes.
Si se limpia el directorio temporal, este entorno deberá prepararse de nuevo.

## Dependencias del backend para Arduino

El endpoint real es POST `/api/alerts/evaluate`, con sensorId, communityId,
sensorName, communityName, readingType y value. La prueba envió una medición
sintética: no se conectó hardware ni se probó Sensor Service en este recorrido.

Actualmente Sensor Service independiente no llama al nuevo Alert Service; el
modo compartido evalúa en el backend compartido. El equipo debe:

1. Conectar la persistencia de una medición con evaluación autenticada en Alert
   Service, con reintentos durables sin perder ni duplicar evaluaciones.
2. Añadir compatiblemente deviceId y messageId a ingestión, validar asociación
   dispositivo/sensor y asegurar unicidad persistente/transaccional del mensaje.
3. Mantener timestamp UTC de recepción y acordar capturedAt UTC para muestras
   almacenadas sin conexión; resolver tipo/unidad/comunidad desde el sensor.
4. Mapear sensorTypeId a readingType y acordar umbrales/unidades. No trasladar
   esa lógica a Angular o al Gateway.

La prevención actual por sensor/fenómeno/alerta activa no deduplica lecturas ni
identifica mensajes del dispositivo. No se añadieron campos, firmware ni
modelos de sensores en esta revisión.

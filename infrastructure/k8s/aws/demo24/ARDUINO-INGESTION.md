# Contrato de ingestión — sin conectar Arduino

Destino público: HTTPS de climateguard.garher.lat, siempre por Gateway. Arduino Uno necesita un puente USB/serial en un equipo con red o un módulo compatible con TLS; no asumir que el Uno por sí solo implementa HTTPS. En esta validación no se abrió ningún puerto serial ni se conectó hardware.

## Preparación manual cuando se instale el equipo

1. Crear en Usuarios una cuenta técnica dedicada con rol Operador. No usar credenciales OAuth, claves de firma JWT ni cuentas personales dentro del firmware.
2. Crear la comunidad y el sensor, elegir el tipo y la unidad real del catálogo. Conservar sus IDs devueltos por la API; no confundir IDs de catálogos con IDs de dispositivo.
3. Un Administrador autenticado vincula el dispositivo mediante POST `/api/sensors/{sensorId}/devices`, cuerpo `deviceId` y `ownerUserId` (UUID de la cuenta dedicada). Un dispositivo queda ligado a un sensor y propietario; reutilizarlo con otro propietario devuelve 409.
4. El puente inicia sesión local privadamente, conserva access/refresh en memoria o almacenamiento privado y rota el refresh mediante el contrato existente. El token debe pertenecer al propietario vinculado y tener rol Operador o Administrador.
5. Cada captura se envía a POST `/api/sensors/{sensorId}/readings/ingest` con Bearer, JSON y campos `deviceId`, `measurementId`, `value`, `capturedAt`, `unit`. IDs admiten letras, números, punto, guion, guion bajo y dos puntos (64 caracteres dispositivo, 128 medición). No introducir el token en URLs ni imprimirlo.

`capturedAt` debe enviarse como ISO-8601 con zona UTC explícita; representa la captura que conoce el puente. Sin reloj físico confiable, documentar que corresponde a recepción en el puente, sin aparentar precisión de adquisición inexistente. Se admiten hasta siete días de antigüedad y cinco minutos de adelanto. La lectura usa como máximo dos decimales y el rango de almacenamiento ±99999999.99; las reglas de riesgo se evalúan aparte. La unidad debe coincidir exactamente con el catálogo.

El puente debe persistir la solicitud antes de enviarla y mantener **measurementId, capturedAt y contenido idénticos durante todos los reintentos**, incluso después de reiniciar. Usar un identificador estable por captura que incluya la sesión de arranque o UUID; `millis()` o un contador reiniciado sin identificador de arranque no bastan.

## Respuestas y durabilidad

- 201: lectura nueva; incluye sensorReadingId y alertEvaluationPending.
- 200 y duplicate=true: reintento idéntico, misma lectura persistida.
- 409: mismo identificador con otro contenido o sensor inactivo; no cambiar el ID automáticamente para ocultar el conflicto.
- 400: formato, unidad, precisión o tiempo inválidos; 401 sin sesión válida; 403 por rol, dispositivo, propietario o sensor no autorizado.
- Ante 429 respetar la ventana de un minuto; ante error temporal conservar el mismo sobre y reintentar con espera acotada.

SQL Server conserva lectura, recibo de deduplicación y sobre de evaluación dentro de la transacción existente. La evaluación Java usa el identificador estable de la lectura. Si alertEvaluationPending=true, consultar el estado y usar POST `/api/sensors/{sensorId}/readings/{readingId}/evaluate` con la misma cuenta autorizada; no crear otra medición para reintentar la evaluación. El estado real es GET `/api/sensors/{sensorId}/readings/evaluation-status`.

Las capturas fuera de orden se conservan, pero no sustituyen lastValue/lastUpdatedAt de una captura más reciente. Dashboard consulta las APIs persistidas al abrir/actualizar y puede mostrar el sensor seleccionado; no se promete streaming por WebSocket.

## Reportería meteorológica

Los ocho tipos PDF usan APIs autenticadas. Para lluvia acumulada, el responsable debe declarar en el filtro de estadísticas/ejecutivo si el firmware entrega incrementos por intervalo o un contador acumulado. No seleccionar una interpretación sin conocer el dispositivo. El contador se resta entre primera y última muestra únicamente si es monotónico; reinicios y ausencia de datos no se estiman. Cada sensor conserva su unidad; no se mezclan variables ni unidades.

## Límite de la evidencia

Los registros TEST K3S de la prueba de protocolo son simulaciones de software claramente identificadas, no observaciones físicas. Las pruebas de API, persistencia y deduplicación no prueban cableado, alimentación, calibración, reloj del dispositivo, firmware, pérdida de puerto serial ni el módulo de red. Esas comprobaciones permanecen para la conexión física.

# Dashboard de monitoreo local

Abrir `http://localhost:4200/dashboard` con una sesión real de Auth. Todas las consultas usan los servicios Angular existentes, el interceptor JWT y el Gateway. No hay localStorage de negocio, métricas precargadas ni nuevas dependencias gráficas.

## Fuentes y significado

| Dato | Fuente real |
| --- | --- |
| Comunidades y coordenadas opcionales | `GET /api/communities` |
| Sensores totales/activos y distribución por tipo | `GET /api/sensors` |
| Alertas activas, resueltas, severidad y actividad | `GET /api/alerts` |
| Evolución de un sensor | `GET /api/sensors/{id}/readings?limit=100` |
| Guardar ubicación como Administrador | `PUT /api/communities/{id}` |

Los listados actuales de comunidades, sensores y alertas no están paginados: las métricas cuentan sus registros reales en la vista seleccionada. `isActive` es un estado administrativo, no una prueba de conectividad. La última actividad es la fecha máxima disponible entre lecturas resumidas en sensores y creación/resolución de alertas; no es un heartbeat. Se retiraron los mensajes fijos de infraestructura operativa.

El filtro de comunidad se aplica por ID a sensores, alertas y mapa. Los registros inactivos y los recursos de prueba claramente identificados no se ocultan de los totales. Las alertas sin comunidad coincidente permanecen visibles en la vista global, con advertencia.

El gráfico SVG dibuja solo valores finitos con fecha válida, ordenados por tiempo real, conservando cero. Una sola lectura se muestra como punto; no se generan muestras intermedias. Hay tabla de valores exactos. La unidad es la original del sensor, sin mezclar series incompatibles. La API limita la respuesta a las últimas 100 lecturas: los filtros de 24 horas/7 días/30 días filtran únicamente esa muestra, no prueban que se haya recuperado todo el historial del periodo.

El servicio compartido escribe fechas de lecturas en UTC pero serializa algunas sin sufijo: se interpretan expresamente como UTC para ordenar/graficar. La hora de recepción de consultas se muestra en hora local y se distingue de la captura del sensor.

Cada actualización general hace tres consultas de catálogo/estado y una consulta de lecturas para el sensor seleccionado. No hay polling. Cambiar el periodo no consulta nuevamente la API; cambiar sensor cancela la consulta anterior. Hay timeout de 15 segundos, cancelación al desmontar, estados de carga, vacío y errores por fuente. Un fallo no se presenta como cero ni como desconexión física.

## Geolocalización y estado de los datos

No se necesitó migración ni modificación de backend/Gateway: `Community` y sus DTO ya admiten Latitude/Longitude; SQL Server confirmó columnas nullable `decimal(9,6)`. Los contratos existentes validan rangos. Angular valida que se introduzcan ambas coordenadas o ninguna y solicita confirmación antes de guardar una ubicación nueva, cambiarla o retirarla. Cancelar conserva el formulario y no escribe. Solo Administrador puede guardar y el backend conserva su autorización.

Los marcadores representan comunidades, no sensores geolocalizados. Popups seguros mediante nodos de texto muestran nombre, cantidad de sensores de la API y estado administrativo. Cian significa ubicación registrada sin riesgo confirmado. Los colores de severidad solo provienen de alertas ACTIVA de esa comunidad; una alerta resuelta o la ausencia de alertas no acredita normalidad.

La revisión encontró tres comunidades, incluida una de prueba. A diferencia del contexto inicial, las dos originales ya devolvían coordenadas:

- ID 1: coordenadas guardadas dentro del área aproximada de Guatemala.
- ID 2: longitud positiva guardada, fuera de Guatemala. No se invirtió el signo ni se corrigió sin evidencia. El mapa advierte de la ubicación fuera del área aproximada y ofrece «Ver ubicaciones» para inspeccionar todos los puntos y «Ver Guatemala» para volver al encuadre inicial.
- ID 1002, `PRUEBA LOCAL AUDITORIA - SIN UBICACION`: sin coordenadas completas.

No se afirma que las coordenadas guardadas hayan sido verificadas físicamente. El mapa utiliza exactamente los datos de la API y mantiene atribución OpenStreetMap. La carga del mapa base requiere conexión a OpenStreetMap; su fallo se distingue de un fallo de la API.

## Validaciones reales, 2026-11-05 (Guatemala)

Chrome con JWT administrativo real coincidió con los endpoints: 3 comunidades, 3 sensores, 0 sensores administrativamente activos, 0 alertas activas, 5 resueltas. Se graficaron las cuatro lecturas existentes del sensor 2. Son lecturas manuales de prueba, identificadas como tales en el nombre del sensor; no se presentaron como hardware real.

Para probar edición se reutilizó únicamente la comunidad de prueba 1002. Temporalmente se identificó como `PRUEBA LOCAL MAPA - PUNTO TEMPORAL NO REAL` y se usó un punto ya registrado del ID 1, con descripción explícita de validación, sin atribuirle una ubicación física real. Cancelar no modificó la API. Confirmar desde Angular devolvió 204; recargar y GET 200 conservaron las coordenadas. El mapa filtrado mostró un marcador de comunidad, sensorCount 1 y riesgo no confirmado. Un PUT con latitud 91 fue rechazado con 400.

Al terminar se restauraron nombre, descripción y coordenadas originales del registro de prueba mediante la API. El listado completo de comunidades coincidió exactamente con el capturado antes de la prueba. Las ubicaciones originales no se alteraron y no quedaron coordenadas de demostración. Las acciones reales de escritura se registraron en la auditoría existente.

Regresión con JWT real: Usuarios, Sensores, Alertas ACTIVA y RESUELTA, Auditoría e historial de Reportes devolvieron 200. No se repitió innecesariamente el CRUD completo de esos módulos.

Pruebas: Angular 103 aprobadas; Sensor Service 26 aprobadas (incluyen pruebas aisladas con SQLite, no producción). Build Angular y backend compartido aprobados. No se iniciaron bases ni ejecutaron migraciones. El build Angular conserva la advertencia previa CommonJS de Leaflet; NuGet reporta advertencias preexistentes NU1902/NU1903 de `System.Security.Cryptography.Pkcs` 9.0.11, pendientes de una actualización de dependencias aparte.

Comandos principales:

```powershell
# Desde frontend
npm.cmd test -- --watch=false
npm.cmd run build
# Desde la raíz; artefactos aislados, sin reiniciar servicios
dotnet test services/sensor-service/tests/ClimateGuard.Sensor.Tests --artifacts-path "$env:TEMP/cg-dashboard-sensor-tests"
dotnet build backend/ClimateGuard.Api --artifacts-path "$env:TEMP/cg-dashboard-backend-build"
```

Chrome escritorio y móvil de 390 px: métricas, cuatro puntos de lectura, filtro por periodo sin peticiones adicionales, confirmación de ubicación, persistencia, popup y ausencia de desbordamiento horizontal. Capturas en `%TEMP%`: `ClimateGuard-dashboard-desktop.png`, `ClimateGuard-dashboard-mobile.png`, `ClimateGuard-dashboard-readings.png`, `ClimateGuard-dashboard-distributions.png`, `ClimateGuard-dashboard-map.png` y `ClimateGuard-dashboard-map-mobile.png`. Las capturas con sufijo `map-test` o `location-confirm` muestran solo la prueba temporal descrita, no la ubicación final de una comunidad.

Pendientes reales: confirmar/corregir la ubicación original fuera de Guatemala con información del responsable; verificar físicamente las ubicaciones; disponer de un contrato de historial paginado o por intervalo si posteriormente se requiere evolución completa. No se tocó AWS, producción, credenciales ni ramas Git.

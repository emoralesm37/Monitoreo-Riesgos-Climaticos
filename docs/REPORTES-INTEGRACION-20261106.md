# Integración selectiva de reportes — 6 de noviembre de 2026

## Estado

Implementados reportes de sensores y lecturas en el Report Service y Angular.
La comprobación automatizada y el recorrido autenticado real pasan. El usuario
inició sesión manualmente en Chrome; se generaron y descargaron los tres tipos
de PDF por Gateway, se recargó el historial y se comprobó persistencia tras
reiniciar Report Service. No se inyectaron sesiones ni se automatizó el login.

## Origen y contratos revisados

- `24b1906`: mappers, plantilla PDF y pruebas RF-REP-02 de Edwin.
- `1b3f193`: enriquecimiento con comunidades y unidades.
- `ca4a3dd`: filtros y plantilla de lecturas RF-REP-03, parcialmente implementado.

Se importaron selectivamente `sensor_mapper.py`, `reading_filters.py`, ambas
plantillas y las pruebas de mappers, adaptando la orquestación al código local.
No se reemplazaron los módulos actuales de comunidades ni la infraestructura.

Las diferencias que impedían usar el código remoto directamente eran:

1. El catálogo real es `/api/catalogs/sensor-types`, no `/api/sensor-types`.
2. El endpoint existente de lecturas devuelve una lista de últimas lecturas,
   limitada a 500. No devuelve `{readings,totalPages}`. Se conserva ese contrato
   y se añade una exportación administrativa paginada independiente.
3. RF-REP-03 remoto acepta reglas opcionales y podría clasificar lecturas antiguas
   usando umbrales actuales. No hay una clasificación histórica fiable en ese
   contrato. Se muestra el estado real de entrega persistido de la evaluación:
   entregada, pendiente o sin evaluación registrada. No equivale a Normal/Crítico.
4. El DTO de sensores no contiene fecha de instalación: el PDF muestra
   «No disponible» en vez de inventarla. Valores cero se conservan como cero.

## Comportamiento añadido

- `POST /api/reports/sensors`, cuerpo JSON opcional con `sensorId`, `communityId`,
  `sensorTypeId` e `isActive`.
- `POST /api/reports/readings`, mismos filtros más `startDate`, `endDate` y
  `evaluationStatus` (`delivered`, `pending`, `unrecorded`). Fechas ISO con zona
  horaria; rango inclusivo. Campos desconocidos o fechas invertidas: 422.
- `GET /api/sensors/{id}/readings/report`: administrador, cursor `afterId`,
  `snapshotId`, `pageSize` de 1 a 500 y rango opcional. El primer lote fija el
  máximo ID por sensor y las siguientes páginas excluyen inserciones posteriores.
  La instantánea es por sensor; no se promete una transacción global entre todos.
- La consulta recorre como máximo 20 000 lecturas por reporte. Un exceso devuelve
  413 y registra fallo; nunca emite un PDF truncado que aparente estar completo.
- Los reportes nuevos guardan filtros, usuario, fechas, estados, archivo y cantidad
  de filas en MongoDB. Un fallo de la fuente deja estado fallido.
- El historial conserva registros previos y añade `skip` y `report_type`; `total`
  representa ahora el total persistido que coincide con el filtro, no solo la página.
  Orden estable por fecha e ID. Lectura de fechas Mongo con zona UTC explícita.
- La descarga conserva la validación existente de nombres/rutas y actualiza
  `downloaded_at` en Mongo. El volumen existente guarda todos los PDF.
- Angular permite escoger tipo, filtros combinados, fechas locales convertidas
  a UTC, historial por tipo y páginas de 50, filas y filtros persistidos, descarga
  Blob con JWT y mensajes para 413/422. No usa datos simulados ni historial local.

Los endpoints siguen siendo exclusivos de Administrador, tanto en Gateway como
en el servicio. Las rutas y políticas del Gateway no se modificaron. No cambian
JWT, Auth ni la generación existente de comunidades. El clasificador de Auditoría
ahora reconoce sensores/lecturas, conservando HMAC, outbox y esquema existentes.

El primer recorrido real detectó HTTP 404 porque Sensor Service en 5026 compila
los controladores compartidos mediante enlaces. Se añadió el controlador al
proyecto activo y dos pruebas de registro/autorización. Después, la exportación
respondió 200 para los tres sensores existentes sin cambiar rutas del Gateway.

## Respaldo y ejecución local

Respaldo:
`C:/Users/USER/Desktop/Gerardo/ClimateGuard-backups/reports-2026-11-06T16-09-04-268Z`.

El inventario inicial contiene 223 archivos pendientes: 218 copias de código y
cinco configuraciones excluidas. Los `.env` reales ignorados no se copiaron ni
se imprimieron. Se añadieron copias desde HEAD de los seis archivos seguidos de
Report Service que estaban limpios al comenzar y se modificaron en esta tarea.
Ningún archivo previamente pendiente fue eliminado. Se verificaron las copias
contra el workspace; los cambios de archivos pendientes se limitan a reportes,
su Compose, el enlace del controlador de sensores y el clasificador/pruebas de
Auditoría y Gateway. También se respaldó CompatibilityTests.cs antes de editarlo.

La imagen anterior queda como
`climateguard-report-service:before-reports-20261106`.
La nueva imagen se construyó y se actualizó exclusivamente el contenedor de
reportes mediante Compose sin dependencias, sin borrar volúmenes. MongoDB no se
recreó ni se modificaron usuarios, contraseñas o datos existentes.

El backend se compiló en `%TEMP%/cg-reports-backend`. Primero se comprobó salud en
7002 y luego se sustituyó únicamente el proceso anterior que escuchaba en 7000.
Se reutiliza la configuración privada existente en memoria; el seeder se desactiva
en ese arranque. Gateway permanece en 5147 y Angular en 4200. No se hicieron
migraciones, cambios de reglas ni inserciones de sensores o lecturas.

Se actualizaron también Sensor Service en 5026 y Gateway en 5147 con compilaciones
aisladas y las configuraciones privadas existentes, conservando el outbox. Se probó
salud en puertos temporales antes de sustituir cada proceso. Un bloqueo de binarios
al ejecutar tests de Gateway se resolvió usando otro directorio de artefactos.

## Pruebas y evidencia

| Verificación | Resultado |
|---|---|
| Report Service, pytest aislado sin red | 38/38 |
| Exportación SQL con SQLite efímero | 4/4 |
| Sensor Service, incluidas pruebas de exportación administrativa | 28/28 |
| Gateway | 50/50 |
| Angular completo | 116/116 |
| Angular reportes, repetido tras ajustar etiquetas accesibles | 13/13 |
| Compilación backend y Angular Development | Correctas |
| Gateway `/health` real | HTTP 200 |
| Report Service `/health/database` real | HTTP 200, Mongo conectado |
| Gateway historial, POST sensores, POST lecturas, exportación sin sesión | HTTP 401 |
| Generación autenticada comunidades/sensores/lecturas | HTTP 200 para los tres |
| Descarga desde Angular | Tres PDF válidos, contenido comprobado |
| Historial tras recargar Angular | HTTP 200, registros persistidos |
| Rango invertido con sesión válida | HTTP 422 |
| PDF y metadata originales tras reiniciar el contenedor | Los tres conservados |
| Auditoría de las tres generaciones posteriores | CONFIRMED, HTTP 200, IDs coincidentes |

Los tests generan PDF reales con WeasyPrint, verifican cabecera `%PDF-`, tamaño,
escape de contenido y persistencia de metadata mediante repositorios simulados.
Las filas de esos tests son fixtures; no fueron insertadas en las bases locales.
Se prueban filtros combinados, cero, fechas con zona e invertidas, errores de fuente,
401/403, cursor que no avanza, instantánea que cambia, límites y fallo al persistir.
La prueba SQL recorre 502 filas de una base efímera y verifica que una inserción
posterior no entra en la segunda página.

La evidencia HTTP real está en `REPORTES-HTTP-20261106.json`, con los recorridos
anterior y posterior al reinicio, IDs persistidos y eventos de Auditoría. Las dos
ejecuciones completas añadieron seis reportes reales al historial; no se borraron.
Al repetir el recorrido, el historial pasó de nueve a doce registros.

Documentos del último recorrido en
`C:/Users/USER/AppData/Local/Temp/ClimateGuard-reports-evidence`:

| Tipo | ID persistido | Archivo | Tamaño |
|---|---|---|---|
| Comunidades | `6aee040747aee7b8896268b7` | `communities_c9920bfa69d748ad89cb6fa702884ced.pdf` | 12 143 bytes |
| Sensores | `6aee040747aee7b8896268b8` | `sensors_ce78bbc70f5f4cc5ab7d765cf7adf25e.pdf` | 12 967 bytes |
| Lecturas | `6aee040847aee7b8896268b9` | `readings_203f7c88cb9f4be997184c82ec0d1945.pdf` | 12 559 bytes |

Se extrajo texto de los PDF del primer recorrido usando pypdf en un contenedor
temporal, sin añadir dependencias al producto. Se comprobaron cuatro comunidades,
tres sensores (incluido valor cero) y cuatro lecturas del sensor 2: 45, 20, 50 y
45. Sus nombres indican pruebas manuales sin hardware: son registros existentes,
no mediciones físicas nuevas. No se inventaron filas. Los documentos examinados
tienen una página y cabecera `%PDF-`. Hay capturas desktop/mobile del historial.

Advertencias observadas: NU1902/NU1903 preexistentes en
`System.Security.Cryptography.Pkcs` 9.0.11 y deprecación Starlette/httpx en pytest.
No se cambiaron dependencias fuera del nuevo proyecto de pruebas de exportación.

## Archivos modificados o añadidos por esta tarea

- `backend/ClimateGuard.Api/Controllers/ReadingReportsController.cs`.
- `backend/tests/ClimateGuard.Report.Tests/{ClimateGuard.Report.Tests.csproj,ReadingExportTests.cs}`.
- `frontend/src/app/core/services/reportes.ts`.
- `frontend/src/app/features/reportes/{reportes.ts,reportes.html,reportes.scss,reportes.spec.ts}`.
- `gateway/tests/ClimateGuard.Gateway.Tests/RoutingTests.cs` (solo pruebas).
- `gateway/ClimateGuard.Gateway/AuditDelivery.cs` y sus `AuditDeliveryTests.cs`.
- `services/sensor-service/ClimateGuard.Sensor.Api/ClimateGuard.Sensor.Api.csproj`.
- `services/sensor-service/tests/ClimateGuard.Sensor.Tests/CompatibilityTests.cs`.
- `services/report-service/app/{config.py,database.py,main.py,pdf_generator.py,report_service.py,repository.py}`.
- `services/report-service/app/{sensor_client.py,sensor_mapper.py,reading_filters.py,report_filters.py}`.
- `services/report-service/app/templates/{sensors.html,readings.html}`.
- `services/report-service/tests/{test_report_mappers.py,test_report_integration.py}`.
- `services/report-service/docker-compose.local.yml` (URL interna de sensores).
- Este informe y `docs/REPORTES-HTTP-20261106.json`.

## Límites y pendientes

- Sin pendientes bloqueantes del recorrido probado. Los filtros de fechas/estados
  y combinaciones tienen pruebas aisladas; el recorrido real ejercitó inventario
  completo, selección de sensor y rechazo de fechas invertidas.
- Máximo 20 000 lecturas y una instantánea por sensor. Para mayor volumen haría
  falta procesamiento asíncrono dedicado.
- El estado es de entrega de evaluación, no clasificación histórica de riesgo;
  la fecha de instalación está ausente en la API. Ambos límites se muestran.
- Se verificó ingestión real de Auditoría con IDs y resultados; no se repitió un
  recorrido manual separado por toda su pantalla administrativa.
- Persisten los avisos de dependencias preexistentes indicados arriba.

No hubo AWS, pull, merges, reset, clean, commits, push, cambios de credenciales ni
eliminación de datos existentes. El recorrido de reportes por Gateway y Chrome
queda verificado con la intervención de login del usuario.

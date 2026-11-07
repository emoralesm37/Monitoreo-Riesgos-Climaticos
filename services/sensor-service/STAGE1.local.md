# Etapa 1: recuperacion local de sensores y reglas

## Correccion aplicada

El Gateway apuntaba correctamente a `localhost:5026`, pero Sensor Service no
estaba iniciado. Se compilo y arranco el proyecto actual con Development y
`Sensor:UseSharedDatabase=true`. `/health/database` confirma `shared-database`.
No se cambiaron rutas del Gateway, JWT, contratos Angular ni modo independiente.

El proceso usa `ConnectionStrings:ClimateGuard` contra SQL Server local
`127.0.0.1:1433`, base `ClimateGuard`, con la credencial existente del contenedor.
JWT coincide con Auth local. Estas variables se entregaron solo al proceso,
sin guardarlas en archivos versionados ni argumentos. Ejecutable aislado en
`%TEMP%/cg-stage1-artifacts/bin/ClimateGuard.Sensor.Api/debug/`; log local en
`%TEMP%/cg-stage1-sensor.log`. No hay migracion automatica al arrancar.
Para futuros arranques deben proporcionarse esas mismas variables locales;
la configuracion por defecto no sustituye la credencial existente.

## Actualizacion SQL

Antes: dos comunidades, cero sensores/lecturas, catalogos existentes con claves
tinyint, tabla Alerts existente y ausencia de AlertRules e historial EF.
Se revisaron columnas y tipos de las dependencias antes de escribir.

`database/updates/20261105_restore_alert_rules.local.sql` reproduce el `Up()`
de `20261007063923_AddAlertRules`: crea solo AlertRules, sus 11 columnas, PK,
tres FK restrictivas, cinco indices (nombre unico) y defaults. No modifica
tablas existentes, no inserta reglas ni cataloga como aplicadas migraciones
anteriores. No ejecutar `database update` ciegamente sobre esta base inicializada
por script: no tiene baseline de EF. Ese baseline requiere revision aparte.
Se ejecuto en una transaccion local y se repitio: la segunda ejecucion no hizo
cambios. No se ejecutaron Down(), DELETE, DROP ni inicializacion de base.

## Evidencia real controlada

- Cuenta administrativa existente, login normal, JWT emitido por Auth.
- GET Gateway sensores/reglas/comunidades/tipos/severidades: 200.
- POST sensor: 201; GET por ID: 200; PUT: 204; PATCH estado: 204.
- Sensor ID **1**, `PRUEBA LOCAL ETAPA1 - MANUAL SIN HARDWARE 20261105`.
- POST `/api/sensors/1/readings/manual`: 200, valor **0**.
- Lectura UTC `2026-11-05T22:28:30.8016181Z`, recuperada mediante
  `/api/sensors/1/readings?limit=100`: 200. No representa una lectura fisica.
- Se utilizo una comunidad existente, sin crear otra. El registro claramente
  marcado se conserva para inspeccion, con su lectura; al terminar se dejo
  **inactivo** desde Angular. No eliminar datos de negocio para limpiar pruebas.
- Chrome: login real, sensor visible, boton Ver lecturas, cero visible,
  desactivacion 204 y pantalla Reglas consultando 200. Captura en
  `%TEMP%/ClimateGuard-stage1-sensor-readings.png`.
- Sin JWT: GET sensores 401. Las operaciones reales de escritura se verificaron
  con Administrador. Los otros roles se comprueban en pruebas aisladas; no se
  crearon usuarios adicionales para esta tarea.
- Auth, comunidades, report admin-check e historial de reportes siguen dando
  200. No se repitio innecesariamente la generacion PDF ya validada.

## Siguiente etapa: una sola fuente de alertas

En modo compartido, `SensorService.RegisterManualValueAsync` llama a
`IAlertEvaluationService` y `IAlertGenerationService` y guarda lecturas y alertas
SQL en la misma operacion. No hay reglas sembradas: esta prueba no genero alertas.
El servicio Java tiene otro motor y otra base. No se llamo a `/api/alerts/evaluate`
ni se conectaron ambos motores. Antes de integrarlo, acordar fuente de verdad,
reglas, entrega tras persistencia y deduplicacion persistente. Suprimir la doble
evaluacion requiere una decision explicita; no corresponde a esta etapa.

## Validaciones reproducibles

```powershell
dotnet build services/sensor-service/ClimateGuard.Sensor.Api/ClimateGuard.Sensor.Api.csproj --artifacts-path "$env:TEMP/cg-stage1-artifacts"
dotnet test services/sensor-service/tests/ClimateGuard.Sensor.Tests/ClimateGuard.Sensor.Tests.csproj --artifacts-path "$env:TEMP/cg-stage1-test-artifacts"
cd frontend
npm.cmd test -- --watch=false
npm.cmd run build
```

La compilacion .NET conserva avisos NU1902/NU1903 preexistentes de
System.Security.Cryptography.Pkcs 9.0.11; no se cambio esa dependencia.

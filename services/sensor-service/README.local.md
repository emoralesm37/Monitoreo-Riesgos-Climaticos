# Sensor Service: desarrollo local compatible

`appsettings.Development.json` establece `Sensor:UseSharedDatabase=true` para
los contratos Angular actuales. `Program.cs` lee esa clave mediante
`builder.Configuration.GetValue<bool>`. No se modificó `appsettings.json`:
fuera de Development, si no se configura la clave, el valor sigue siendo false.

## Configuración y precedencia

La configuración estándar de ASP.NET Core carga JSON base, JSON del entorno,
User Secrets en Development, variables de entorno y argumentos de arranque.
Los proveedores posteriores prevalecen. `Sensor__UseSharedDatabase=false`
puede seleccionar el modo independiente aun en Development; no se cambió
ninguna variable existente. Revisar también argumentos y User Secrets antes de
atribuir el modo efectivo únicamente al archivo JSON.

Los perfiles HTTP/HTTPS existentes seleccionan Development. .NET no carga un
archivo `.env` automáticamente: usar el mecanismo de configuración local ya
acordado, sin guardar credenciales en archivos versionados.

## Dependencias

- SQL Server local/de pruebas con el esquema compartido de ClimateGuard ya
  preparado. La cadena requerida es `ConnectionStrings:ClimateGuard`, o su
  equivalente `ConnectionStrings__ClimateGuard`; `SensorDatabase` corresponde
  al modo independiente y no la sustituye.
- `Jwt:Key`, `Jwt:Issuer` y `Jwt:Audience` compatibles con Auth/Gateway.
- El servicio reutiliza mediante referencias de proyecto Infrastructure,
  controladores y servicios del backend compartido; no necesita que el proceso
  HTTP del backend esté activo para ejecutar sus propias rutas de sensores.
- El frontend completo sí sigue necesitando el backend HTTP en 7000 para
  comunidades, catálogos y reglas, además de Auth en 7101 y Gateway en 5147.
- La evaluación/generación en modo compartido ocurre en el backend compartido;
  no se incorpora aquí una llamada al Alert Service Java.

No ejecutar inicializaciones o migraciones contra una base existente para
probar este cambio. Configurar explícitamente una base de pruebas antes de
iniciar el servicio o consultar su salud de base de datos.

## Arranque y comprobación manual posterior

Con dependencias y configuración de pruebas disponibles, desde la raíz:

```powershell
dotnet run --project services/sensor-service/ClimateGuard.Sensor.Api --launch-profile http
```

El perfil HTTP escucha en localhost:5026. Confirmar el entorno Development en
el arranque y, mediante el depurador, inspeccionar únicamente `sharedDatabase`
o `builder.Configuration.GetValue<bool>("Sensor:UseSharedDatabase")`; no volcar
la configuración completa ni sus secretos.

`GET /health` solo acredita que el proceso responde. En modo compartido,
`GET /health/database`, si conecta, incluye `mode: "shared-database"`.
Un 503 no permite inferir el modo. Consultar este endpoint solo después de
confirmar que la conexión apunta al SQL Server de pruebas.

Con JWT autorizado, comprobar directamente o a través del Gateway:

- GET `/api/sensors/{id}/readings?limit=100`: arreglo de lecturas.
- POST `/api/sensors/{id}/readings/manual`: escritura, solo en datos de prueba.
- PATCH `/api/sensors/{id}/status` y POST `/api/sensors/{id}/reset`.
- El DTO de sensores conserva nombre de comunidad y unidad.

Las escrituras conservan las restricciones Administrador/Operador y JWT. No
se modificaron endpoints ni políticas de autorización.

## Validación sin servicios externos

```powershell
dotnet build services/sensor-service/ClimateGuard.Sensor.Api/ClimateGuard.Sensor.Api.csproj
dotnet test services/sensor-service/tests/ClimateGuard.Sensor.Tests/ClimateGuard.Sensor.Tests.csproj
```

Las pruebas compatibles usan dobles de servicio; las independientes seleccionan
false explícitamente y usan SQLite en memoria. Las pruebas de configuración
leen los JSON reales y comprueban los valores Development/Production y la
precedencia de una variable de prueba con prefijo único. No cambian la variable
real `Sensor__UseSharedDatabase` ni se conectan a bases externas.

Si hay un ejecutable local en uso, compilar con `--artifacts-path` apuntando a
una carpeta temporal nueva para evitar modificar sus binarios en ejecución.

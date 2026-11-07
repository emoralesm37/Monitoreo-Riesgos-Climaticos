# Rutas administrativas en desarrollo

Las rutas nuevas se cargan exclusivamente con `ASPNETCORE_ENVIRONMENT=Development`.
No se modifican los destinos ni las rutas de producción en `appsettings.json`.

| Método y ruta pública | Destino local | Contrato existente |
| --- | --- | --- |
| GET, POST `/api/users` | Auth `http://localhost:7101/users` | Listar y crear usuarios |
| GET, PATCH `/api/users/{id}` | Auth `/users/{id}` | Consultar y actualizar; ID UUID |
| PATCH `/api/users/{id}/status` | Auth `/users/{id}/status` | JSON `{ "isActive": true }` |
| GET `/api/roles` | Auth `/roles` | Listar roles; no existe CRUD adicional |
| GET `/api/reports/admin-check` | Report `/api/reports/admin-check` | Comprobar autorización |
| POST `/api/reports/communities` | Report `/api/reports/communities` | Generar reporte sin cuerpo; devuelve report_id y file_name |
| GET `/api/reports/history?limit=50` | Report `/api/reports/history?limit=50` | Historial `{ total, reports }`; límite 1–100 |
| GET `/api/reports/{report_id}/download` | Report misma ruta | PDF y nombre de descarga; 404 si no existe |

Las tres familias exigen JWT válido y claim `role` exactamente `Administrador`,
igual que `users.controller.ts`, `roles.controller.ts` y `report-service/app/security.py`.
No se traducen roles ADMIN/OPERATOR/VIEWER ni se crean endpoints del backend.
El Gateway conserva Authorization, cuerpo, consulta, códigos y contenido de respuesta.
Los servicios destino vuelven a validar el JWT y sus permisos.

## Puerto explícito de Report Service

Report Service no fijaba un puerto de arranque en su código. Para este escenario
de desarrollo se establece **127.0.0.1:8000** en el Gateway y en el siguiente
comando de referencia, que debe ejecutarse desde `services/report-service`
cuando se autorice iniciar servicios:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Requiere las dependencias Python y nativas de WeasyPrint, MongoDB de pruebas,
`MONGO_HOST`, `MONGO_PORT`, `MONGO_DATABASE`, `MONGO_REPORT_USERNAME`,
`MONGO_REPORT_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
y `COMMUNITY_SERVICE_URL` (base URL; el cliente añade `/api/communities`).
El JWT debe compartir clave/issuer/audience con Auth y Gateway (`Jwt:Key`,
`Jwt:Issuer`, `Jwt:Audience`). No usar bases ni credenciales de producción.
La configuración actual del servicio puede leer `.env` de la raíz y de MongoDB;
verificar sus destinos antes de cualquier arranque. Esta tarea no los modifica.

El destino puede sobrescribirse con la variable de configuración .NET
`ReverseProxy__Clusters__report-service__Destinations__primary__Address`.
No se sobrescriben variables existentes ni se elige un destino de producción.

El Gateway se podrá iniciar, con sus valores JWT locales ya configurados, así:

```powershell
dotnet run --project gateway/ClimateGuard.Gateway -- --environment Development
```

Usar el puerto que anuncie el Gateway. Con un access token local de Administrador,
consultar desde un cliente HTTP `/api/users`, `/api/roles`,
`/api/reports/admin-check` y `/api/reports/history?limit=50`.
Sin token se espera 401; con otro rol, 403. Generación y descarga requieren
MongoDB, comunidades y PDF operativos. Angular no se modifica en esta tarea.

## Validación aislada

```powershell
dotnet build gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj --artifacts-path "$env:TEMP/climateguard-gateway-build"
dotnet test gateway/tests/ClimateGuard.Gateway.Tests/ClimateGuard.Gateway.Tests.csproj --artifacts-path "$env:TEMP/climateguard-gateway-routing-tests"
```

Las pruebas arrancan el Gateway **en memoria** y sustituyen todos los destinos
por un handler simulado. No abren puertos, no arrancan otros servicios ni acceden
a bases. Verifican rutas, método/cuerpo/query/token, CORS, permisos 401/403,
errores del destino, rutas anteriores y ausencia de rutas nuevas en Production.
No constituyen validación real de Auth, MongoDB o generación PDF.

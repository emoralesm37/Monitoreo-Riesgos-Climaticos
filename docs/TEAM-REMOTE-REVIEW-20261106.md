# Cambios del equipo y cierre OAuth ? 6 de noviembre de 2026

Revisi?n de las 24 ramas remotas anunciadas por origin tras git fetch. HEAD local: a244f2caa2c5bdcfd460d56dd8abe2095b12a5ab.
Las fechas de Git conservan el huso de cada autor; las novedades descritas aqu? usan Guatemala (UTC?06).
No se consultaron PR, checks de CI ni ramas eliminadas del servidor: la evidencia procede de referencias y objetos Git de GitHub obtenidos mediante fetch.

## Respaldo y conservaci?n

Antes de editar: 221 archivos modificados o nuevos, expandidos desde git ls-files; git status agrupa directorios.
Respaldo: C:\Users\USER\Desktop\Gerardo\ClimateGuard-backups\oauth-review-2026-11-06T16-03-10-914Z. Contiene 216 copias y tracked.patch, m?s manifest.json con HEAD y estado inicial.
Se excluyeron del respaldo 2 ejemplos .env y 3 appsettings.Development.json; permanecen intactos en el workspace. Los .env reales ignorados no se abrieron ni copiaron. Este respaldo es de c?digo pendiente, no de configuraci?n sensible ni bases de datos.

## Hallazgos y decisiones

| ?rea | Autor / commits recientes | Ya tenemos | Falta / conflicto / recomendaci?n |
|---|---|---|---|
| OAuth/OIDC | Julieta: a8be7b7, 05/11 22:10; 5e1c69e, 05/11 23:21 | Flujo local Google OIDC y GitHub OAuth con PKCE/estado/cookie/ticket; usuarios externos Viewer; vinculaci?n expl?cita; claims role/roles/permissions/provider y proveedor al renovar | Mejora de Julieta ya adaptada desde la revisi?n anterior. No hay commits nuevos en sus ramas tras este fetch. Sus callbacks Passport y externalLogin no son compatibles directamente con OAuthService local. Conservar implementaci?n local y pruebas equivalentes. |
| JWT y permisos | Julieta: dd365bf, ea048f2, 5e1c69e | Login/refresh/logout; guard por roles; JWT validado con usuario activo/rol actual; rotaci?n en transacci?n | permissions son descriptivos, no pol?ticas nuevas. reports:read/generate de Viewer/Operador no habilitan rutas: report-service y Gateway siguen exigiendo Administrador. Hay que acordar contrato de permisos antes de usar esos claims para UI o autorizaci?n. |
| Sensores | Edwin (autor Git emoralesm37): 0fe8aeb, 46916d8, 242cb25; 5304a4c, 06/11 05:10 | CRUD/JWT y lecturas ya incorporados previamente; cambios locales adicionales para lectura?evaluaci?n?alerta | 5304a4c a?ade rutas de sensores f?sicos a gateway/appsettings.json y corrige inyecci?n de repositorios en la antigua AuthService. No aporta hardware ni un nuevo microservicio f?sico. No trasplantar constructor: la implementaci?n OAuth local tiene otra estructura. Revisar rutas/precedencia/entorno antes de habilitarlas. |
| Reportes | Edwin: 24b1906 05/11 11:42, 1b3f193 18:42, ca4a3dd 21:37 | Reporte de comunidades, historial, PDF, JWT, frontend y Docker local | Faltan sensor_client.py, sensor_mapper.py, templates/sensors.html, pruebas de mappers y RF-REP-02; tambi?n reading_filters.py, reading_status.py y templates/readings.html de RF-REP-03 parcial. main.py/config.py/report_service.py/pdf_generator.py colisionan conceptualmente con el servicio local; integrar RF-REP-02 selectivamente primero, con pruebas. RF-REP-03 requiere revisi?n de filtros/estados y fuente de lecturas. |
| Auditor?a | Edwin: 198136e, 06/11 02:18 | Auditor?a local con HMAC, outbox de Gateway, consulta administrativa, pruebas y UI | Remoto a?ade AuditClientService en Auth y servicio POST con X-Service-Key. Contrato incompatible con HMAC/event_id/actor/module/result/http_status local. Importarlo causar?a rechazos o duplicados; acordar productor y esquema antes. No sustituir el servicio local ni duplicar productores. |
| Alertas | Julieta: e60c17b y 54b9ef9, 04/11 | Servicio Java/PostgreSQL ya adaptado; evaluaci?n persistente por medici?n/regla y reintento local | Los commits no figuran como ancestros de HEAD, pero gran parte del contenido fue integrado selectivamente. Copiar las versiones remotas podr?a perder evaluaci?n por reglas activas, V2 y deduplicaci?n local. No integrar en este turno. |
| Comunidades | Julieta: 46370e8, 956647a, b7076b8, 02/11 | Servicio y Docker presentes; frontend conserva administraci?n y roles locales | C?digo puede coincidir aunque historia diverja. Revisar en una integraci?n propia; evitar reemplazar configuraci?n de Gateway o persistencia SQL compartida. |
| Docker/MongoDB | Edwin: 6b66b26; Julieta: b7076b8/e60c17b | MongoDB, contenedores locales para reportes/alertas/auditor?a, scripts de operaci?n existentes | Las ramas remotas no incluyen todos los archivos Docker locales. No reemplazar compose ni scripts ni variables existentes. Falta acordar despliegue conjunto y healthchecks despu?s de contratos funcionales. |
| M?dulos nuevos | Auditor?a y reportes de sensores/lecturas; rutas de sensores f?sicos | Auditor?a local ya m?s desarrollada que la versi?n remota examinada | No se encontr? un nuevo servicio f?sico independiente en los commits recientes. Rutas no equivalen a hardware implementado. |

## Resultado OAuth y pruebas

Se mantiene la integraci?n selectiva ya existente de a8be7b7/5e1c69e; no se import? c?digo de Edwin ni se fusionaron ramas.
Este turno a?ade ?nicamente dos pruebas JWT: compatibilidad de refresh antiguo sin provider y rechazo de proveedor desconocido firmado.

- Auth: suite completa 51/51 y build correcto; despu?s de a?adir los dos casos, suite focalizada auth.service.spec.ts 15/15 (13 previos + 2 nuevos). Total de casos Auth presentes: 53.
- Frontend: 112/112 en 24 archivos. Incluye login/callbacks/interceptor/Usuarios/Alertas/Auditor?a.
- Gateway: 44/44, incluyendo 401 sin identidad y 403 con rol insuficiente.
- Auditor?a: 10/10, pytest con red deshabilitada y Mongo simulado.
- Alertas Java: mvn -o test -q en imagen local aislada y H2; ejecuci?n correcta, sin usar PostgreSQL activo.

Google se valida con tokens OIDC RSA sint?ticos, issuer/audience/nonce/firma/expiraci?n y correo verificado; GitHub con respuestas HTTP simuladas y correo principal verificado. Ambos callbacks prueban entrega/redirecci?n de ticket y errores saneados. Nuevos usuarios reciben Viewer y no contrase?a local. Coincidencia de correo exige vinculaci?n expl?cita; identidad de otra cuenta se rechaza. Refresh conserva proveedor, renueva claims desde el rol actual, rechaza reutilizaci?n y se revoca con logout.

OAuth est? integrado y pasa la validaci?n automatizada aislada. No se certifica cierre integral con proveedores reales ni concurrencia PostgreSQL: faltan una prueba de refresh concurrente/rollback sobre PostgreSQL ef?mero y un recorrido manual asistido tras reiniciar servicios. No se automatizaron cuentas reales ni se usaron credenciales del usuario.

## Pr?ximas integraciones propuestas (sin ejecutar)

1. Completar verificaci?n OAuth contra PostgreSQL ef?mero y luego navegador con intervenci?n del usuario.
2. Integrar RF-REP-02 de Edwin (24b1906 + 1b3f193) selectivamente: contrato de sensores/comunidades, mappers, PDF e historial; probar errores upstream, permisos, datos vac?os y l?mites. Es el siguiente incremento funcional recomendado.
3. Revisar RF-REP-03 ca4a3dd como trabajo parcial; acordar filtros, estados, paginaci?n y fuente de lecturas antes de exponerlo.
4. Reconciliar auditor?a 198136e con el esquema HMAC/outbox local. Definir eventos de login/refresh y evitar duplicados antes de conectar Auth.
5. Evaluar rutas f?sicas de 5304a4c y consolidaci?n Docker. Sin cambios a AWS.

No se ejecutaron pull, reset, clean, commits, push ni merges. Las colisiones indicadas son riesgos por archivos compartidos/diferencias; no se simul? un merge en el ?rbol sucio.

## Comparaci?n por rama

A/B = commits exclusivos de HEAD / exclusivos de la rama remota. No equivale a funciones faltantes: hubo integraciones selectivas. Archivos se cuentan desde merge-base hasta la rama; no son un diff puro contra el ?rbol local. El JSON adjunto ofrece paths completos y comparaci?n de contenido, excluyendo configuraci?n sensible.

| Rama (origin/) | Punta: autor, fecha, commit | A/B | Archivos remotos / pendientes solapados | Estado |
|---|---|---|---|---|
| Dev | emoralesm37, 2026-11-06T02:35:28-06:00, d72b09a | 6/24 | 96 / 18 | Divergente; revisar detalle abajo |
| Pruebas | emoralesm37, 2026-11-06T02:38:34-06:00, df3d48a | 6/25 | 96 / 18 | Divergente; revisar detalle abajo |
| edwin-backend-integration | emoralesm37, 2026-10-09T01:29:05-06:00, c0887ab | 42/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| edwin-docker-database | emoralesm37, 2026-08-21T22:58:26-06:00, 28d2b9c | 102/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/backend-configuration | julietapinto, 2026-08-19T22:53:10-06:00, 10cc43c | 124/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/backend-infraestructura | julietapinto, 2026-08-18T23:34:04-06:00, a8244c4 | 126/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/communities-catalogs | julietapinto, 2026-08-20T23:54:48-06:00, b2e5998 | 110/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/domain-persistence | julietapinto, 2026-08-20T21:41:34-06:00, f84a15e | 121/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/fase2-comunidades-sensores | julietapinto, 2026-10-07T21:03:13-06:00, 520b414 | 55/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/fase3-alert-rules | julietapinto, 2026-11-04T22:09:14-06:00, 54b9ef9 | 8/7 | 50 / 7 | Divergente; revisar detalle abajo |
| feature/fase3-alert-service | julietapinto, 2026-11-04T21:29:16-06:00, e60c17b | 8/5 | 49 / 7 | Divergente; revisar detalle abajo |
| feature/fase3-auth-completion | julietapinto, 2026-10-26T22:43:53-06:00, dd365bf | 13/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/fase3-auth-service | julietapinto, 2026-10-23T23:21:18-06:00, ea048f2 | 36/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/fase3-community-service | julietapinto, 2026-11-02T22:21:45-06:00, b7076b8 | 8/3 | 28 / 0 | Divergente; revisar detalle abajo |
| feature/fase3-edwin-microservices | emoralesm37, 2026-11-06T05:10:38-06:00, 5304a4c | 6/27 | 96 / 18 | Divergente; revisar detalle abajo |
| feature/fase4-auth-claims-tests | julietapinto, 2026-11-05T23:21:10-06:00, 5e1c69e | 6/17 | 87 / 16 | Divergente; revisar detalle abajo |
| feature/fase4-auth-oauth | julietapinto, 2026-11-05T22:10:08-06:00, a8be7b7 | 8/9 | 63 / 14 | Divergente; revisar detalle abajo |
| feature/frontend-angular | GarHer1399, 2026-10-24T10:35:13-06:00, 20d3428 | 26/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| feature/sensor-contracts | julietapinto, 2026-08-20T23:21:57-06:00, 6f115c9 | 115/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| fix/api-integration-validation | julietapinto, 2026-08-21T20:45:15-06:00, 1376421 | 104/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| fix/sensor-query-ordering | julietapinto, 2026-08-21T20:27:32-06:00, 88d5070 | 106/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| integration/entrega-final | emoralesm37, 2026-10-08T19:57:29-06:00, 20932ed | 41/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| integration/fase3-unificada | Ubuntu, 2026-10-24T18:23:48Z, 94e4998 | 13/0 | 0 / 0 | Ancestro de HEAD; ya incluido por historia |
| main | emoralesm37, 2026-11-06T02:40:26-06:00, c26a72d | 6/26 | 96 / 18 | Divergente; revisar detalle abajo |

### origin/Dev

Punta: d72b09a|2026-11-06T02:35:28-06:00|emoralesm37|Merge pull request #56 from emoralesm37/feature/fase3-edwin-microservices.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- d72b09a ? 2026-11-06T02:35:28-06:00 ? emoralesm37 ? Merge pull request #56 from emoralesm37/feature/fase3-edwin-microservices
- 00a794c ? 2026-11-06T02:32:51-06:00 ? emoralesm37 ? Merge branch 'Dev' into feature/fase3-edwin-microservices
- 2e9067b ? 2026-11-06T02:23:04-06:00 ? emoralesm37 ? Merge remote-tracking branch 'origin/main' into feature/fase3-edwin-microservices
- 198136e ? 2026-11-06T02:18:44-06:00 ? emoralesm37 ? feat(audit): implement audit service and gateway integration
- f45c2a1 ? 2026-11-05T23:22:20-06:00 ? julietapinto ? Merge pull request #55 from emoralesm37/feature/fase4-auth-claims-tests
- 5e1c69e ? 2026-11-05T23:21:10-06:00 ? julietapinto ? feat(auth): add JWT claims and OAuth callback tests
- bbb2b58 ? 2026-11-05T22:12:04-06:00 ? julietapinto ? Merge pull request #54 from emoralesm37/feature/fase4-auth-oauth
- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- d3a083e ? 2026-11-05T21:55:08-06:00 ? emoralesm37 ? Merge pull request #53 from emoralesm37/Pruebas
- be0f66d ? 2026-11-05T21:53:07-06:00 ? emoralesm37 ? Merge pull request #52 from emoralesm37/Dev
- eedc8dd ? 2026-11-05T21:50:00-06:00 ? emoralesm37 ? Merge pull request #51 from emoralesm37/feature/fase3-edwin-microservices
- ca4a3dd ? 2026-11-05T21:37:49-06:00 ? emoralesm37 ? feat(report-service): implement RF-REP-03 reporte lecturas (parcial)
- 1b3f193 ? 2026-11-05T18:42:50-06:00 ? emoralesm37 ? feat(report): complete RF-REP reporte sensores e integracion
- 24b1906 ? 2026-11-05T11:42:17-06:00 ? emoralesm37 ? feat(report-service): implementa reporte de sensores RF-REP-02 y pruebas
- 9dbb036 ? 2026-11-05T09:21:43-06:00 ? emoralesm37 ? feat(report-service): agrega seguridad JWT, reportes de comunidades, historial y descarga PDF
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- 6b66b26 ? 2026-11-04T02:01:50-06:00 ? emoralesm37 ? feat: agrego infra de MongoDB y servicio de reportes
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
M	.gitignore
M	gateway/ClimateGuard.Gateway/appsettings.json
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

Riesgo de colisi?n con archivos pendientes:

- .gitignore (revisar diferencia; no sobrescribir)
- infrastructure/mongodb/create-users.sh (revisar diferencia; no sobrescribir)
- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/audit-service/app/main.py (revisar diferencia; no sobrescribir)
- services/audit-service/requirements.txt (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

### origin/Pruebas

Punta: df3d48a|2026-11-06T02:38:34-06:00|emoralesm37|Merge pull request #57 from emoralesm37/Dev.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- df3d48a ? 2026-11-06T02:38:34-06:00 ? emoralesm37 ? Merge pull request #57 from emoralesm37/Dev
- d72b09a ? 2026-11-06T02:35:28-06:00 ? emoralesm37 ? Merge pull request #56 from emoralesm37/feature/fase3-edwin-microservices
- 00a794c ? 2026-11-06T02:32:51-06:00 ? emoralesm37 ? Merge branch 'Dev' into feature/fase3-edwin-microservices
- 2e9067b ? 2026-11-06T02:23:04-06:00 ? emoralesm37 ? Merge remote-tracking branch 'origin/main' into feature/fase3-edwin-microservices
- 198136e ? 2026-11-06T02:18:44-06:00 ? emoralesm37 ? feat(audit): implement audit service and gateway integration
- f45c2a1 ? 2026-11-05T23:22:20-06:00 ? julietapinto ? Merge pull request #55 from emoralesm37/feature/fase4-auth-claims-tests
- 5e1c69e ? 2026-11-05T23:21:10-06:00 ? julietapinto ? feat(auth): add JWT claims and OAuth callback tests
- bbb2b58 ? 2026-11-05T22:12:04-06:00 ? julietapinto ? Merge pull request #54 from emoralesm37/feature/fase4-auth-oauth
- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- d3a083e ? 2026-11-05T21:55:08-06:00 ? emoralesm37 ? Merge pull request #53 from emoralesm37/Pruebas
- be0f66d ? 2026-11-05T21:53:07-06:00 ? emoralesm37 ? Merge pull request #52 from emoralesm37/Dev
- eedc8dd ? 2026-11-05T21:50:00-06:00 ? emoralesm37 ? Merge pull request #51 from emoralesm37/feature/fase3-edwin-microservices
- ca4a3dd ? 2026-11-05T21:37:49-06:00 ? emoralesm37 ? feat(report-service): implement RF-REP-03 reporte lecturas (parcial)
- 1b3f193 ? 2026-11-05T18:42:50-06:00 ? emoralesm37 ? feat(report): complete RF-REP reporte sensores e integracion
- 24b1906 ? 2026-11-05T11:42:17-06:00 ? emoralesm37 ? feat(report-service): implementa reporte de sensores RF-REP-02 y pruebas
- 9dbb036 ? 2026-11-05T09:21:43-06:00 ? emoralesm37 ? feat(report-service): agrega seguridad JWT, reportes de comunidades, historial y descarga PDF
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- 6b66b26 ? 2026-11-04T02:01:50-06:00 ? emoralesm37 ? feat: agrego infra de MongoDB y servicio de reportes
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
M	.gitignore
M	gateway/ClimateGuard.Gateway/appsettings.json
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

Riesgo de colisi?n con archivos pendientes:

- .gitignore (revisar diferencia; no sobrescribir)
- infrastructure/mongodb/create-users.sh (revisar diferencia; no sobrescribir)
- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/audit-service/app/main.py (revisar diferencia; no sobrescribir)
- services/audit-service/requirements.txt (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

### origin/edwin-backend-integration

Punta: c0887ab|2026-10-09T01:29:05-06:00|emoralesm37|feat: implementar generacion automatica de alertas RF-ADM-33.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/edwin-docker-database

Punta: 28d2b9c|2026-08-21T22:58:26-06:00|emoralesm37|feat: completar configuración Docker y SQL Server para ClimateGuard.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/backend-configuration

Punta: 10cc43c|2026-08-19T22:53:10-06:00|julietapinto|feat: configurar middleware de API, CORS y Swagger.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/backend-infraestructura

Punta: a8244c4|2026-08-18T23:34:04-06:00|julietapinto|feat: create backend foundation and health endpoint.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/communities-catalogs

Punta: b2e5998|2026-08-20T23:54:48-06:00|julietapinto|feat: exponer endpoints de comunidades y catálogos.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/domain-persistence

Punta: f84a15e|2026-08-20T21:41:34-06:00|julietapinto|feat: registrar servicios de persistencia en base de datos.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/fase2-comunidades-sensores

Punta: 520b414|2026-10-07T21:03:13-06:00|julietapinto|feat(communities): implement community administration and database migration.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/fase3-alert-rules

Punta: 54b9ef9|2026-11-04T22:09:14-06:00|julietapinto|Agregar reglas, evaluación y prevención de duplicados.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

Riesgo de colisi?n con archivos pendientes:

- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)

### origin/feature/fase3-alert-service

Punta: e60c17b|2026-11-04T21:29:16-06:00|julietapinto|Implementar microservicio de alertas con JWT y PostgreSQL.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

Riesgo de colisi?n con archivos pendientes:

- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)

### origin/feature/fase3-auth-completion

Punta: dd365bf|2026-10-26T22:43:53-06:00|julietapinto|feat(auth): completar usuarios, roles y autorización JWT.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/fase3-auth-service

Punta: ea048f2|2026-10-23T23:21:18-06:00|julietapinto|feat(auth): implementar renovación de token y cierre de sesión.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/fase3-community-service

Punta: b7076b8|2026-11-02T22:21:45-06:00|julietapinto|feat(comunidades): agregar contenedor y configuración de entorno.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

Riesgo de colisi?n con archivos pendientes:

Ninguno por path pendiente; pueden existir diferencias en archivos ya seguidos.

### origin/feature/fase3-edwin-microservices

Punta: 5304a4c|2026-11-06T05:10:38-06:00|emoralesm37|feat: configurar rutas de sensores fisicos y repositorios de autenticacion.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- 5304a4c ? 2026-11-06T05:10:38-06:00 ? emoralesm37 ? feat: configurar rutas de sensores fisicos y repositorios de autenticacion
- c26a72d ? 2026-11-06T02:40:26-06:00 ? emoralesm37 ? Merge pull request #58 from emoralesm37/Pruebas
- df3d48a ? 2026-11-06T02:38:34-06:00 ? emoralesm37 ? Merge pull request #57 from emoralesm37/Dev
- d72b09a ? 2026-11-06T02:35:28-06:00 ? emoralesm37 ? Merge pull request #56 from emoralesm37/feature/fase3-edwin-microservices
- 00a794c ? 2026-11-06T02:32:51-06:00 ? emoralesm37 ? Merge branch 'Dev' into feature/fase3-edwin-microservices
- 2e9067b ? 2026-11-06T02:23:04-06:00 ? emoralesm37 ? Merge remote-tracking branch 'origin/main' into feature/fase3-edwin-microservices
- 198136e ? 2026-11-06T02:18:44-06:00 ? emoralesm37 ? feat(audit): implement audit service and gateway integration
- f45c2a1 ? 2026-11-05T23:22:20-06:00 ? julietapinto ? Merge pull request #55 from emoralesm37/feature/fase4-auth-claims-tests
- 5e1c69e ? 2026-11-05T23:21:10-06:00 ? julietapinto ? feat(auth): add JWT claims and OAuth callback tests
- bbb2b58 ? 2026-11-05T22:12:04-06:00 ? julietapinto ? Merge pull request #54 from emoralesm37/feature/fase4-auth-oauth
- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- d3a083e ? 2026-11-05T21:55:08-06:00 ? emoralesm37 ? Merge pull request #53 from emoralesm37/Pruebas
- be0f66d ? 2026-11-05T21:53:07-06:00 ? emoralesm37 ? Merge pull request #52 from emoralesm37/Dev
- eedc8dd ? 2026-11-05T21:50:00-06:00 ? emoralesm37 ? Merge pull request #51 from emoralesm37/feature/fase3-edwin-microservices
- ca4a3dd ? 2026-11-05T21:37:49-06:00 ? emoralesm37 ? feat(report-service): implement RF-REP-03 reporte lecturas (parcial)
- 1b3f193 ? 2026-11-05T18:42:50-06:00 ? emoralesm37 ? feat(report): complete RF-REP reporte sensores e integracion
- 24b1906 ? 2026-11-05T11:42:17-06:00 ? emoralesm37 ? feat(report-service): implementa reporte de sensores RF-REP-02 y pruebas
- 9dbb036 ? 2026-11-05T09:21:43-06:00 ? emoralesm37 ? feat(report-service): agrega seguridad JWT, reportes de comunidades, historial y descarga PDF
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- 6b66b26 ? 2026-11-04T02:01:50-06:00 ? emoralesm37 ? feat: agrego infra de MongoDB y servicio de reportes
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
M	.gitignore
M	gateway/ClimateGuard.Gateway/appsettings.json
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

Riesgo de colisi?n con archivos pendientes:

- .gitignore (revisar diferencia; no sobrescribir)
- infrastructure/mongodb/create-users.sh (revisar diferencia; no sobrescribir)
- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/audit-service/app/main.py (revisar diferencia; no sobrescribir)
- services/audit-service/requirements.txt (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

### origin/feature/fase4-auth-claims-tests

Punta: 5e1c69e|2026-11-05T23:21:10-06:00|julietapinto|feat(auth): add JWT claims and OAuth callback tests.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- 5e1c69e ? 2026-11-05T23:21:10-06:00 ? julietapinto ? feat(auth): add JWT claims and OAuth callback tests
- bbb2b58 ? 2026-11-05T22:12:04-06:00 ? julietapinto ? Merge pull request #54 from emoralesm37/feature/fase4-auth-oauth
- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- eedc8dd ? 2026-11-05T21:50:00-06:00 ? emoralesm37 ? Merge pull request #51 from emoralesm37/feature/fase3-edwin-microservices
- ca4a3dd ? 2026-11-05T21:37:49-06:00 ? emoralesm37 ? feat(report-service): implement RF-REP-03 reporte lecturas (parcial)
- 1b3f193 ? 2026-11-05T18:42:50-06:00 ? emoralesm37 ? feat(report): complete RF-REP reporte sensores e integracion
- 24b1906 ? 2026-11-05T11:42:17-06:00 ? emoralesm37 ? feat(report-service): implementa reporte de sensores RF-REP-02 y pruebas
- 9dbb036 ? 2026-11-05T09:21:43-06:00 ? emoralesm37 ? feat(report-service): agrega seguridad JWT, reportes de comunidades, historial y descarga PDF
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- 6b66b26 ? 2026-11-04T02:01:50-06:00 ? emoralesm37 ? feat: agrego infra de MongoDB y servicio de reportes
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

Riesgo de colisi?n con archivos pendientes:

- .gitignore (revisar diferencia; no sobrescribir)
- infrastructure/mongodb/create-users.sh (revisar diferencia; no sobrescribir)
- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

### origin/feature/fase4-auth-oauth

Punta: a8be7b7|2026-11-05T22:10:08-06:00|julietapinto|Google and GitHub OAuth login.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

Riesgo de colisi?n con archivos pendientes:

- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

### origin/feature/frontend-angular

Punta: 20d3428|2026-10-24T10:35:13-06:00|GarHer1399|feat: agregar Compose local con Nginx y Gateway en Docker.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/feature/sensor-contracts

Punta: 6f115c9|2026-08-20T23:21:57-06:00|julietapinto|feat: exponer endpoints REST de sensores.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/fix/api-integration-validation

Punta: 1376421|2026-08-21T20:45:15-06:00|julietapinto|fix: corregir validaciones y consultas de sensores.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/fix/sensor-query-ordering

Punta: 88d5070|2026-08-21T20:27:32-06:00|julietapinto|fix: corregir consulta de listado de sensores.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/integration/entrega-final

Punta: 20932ed|2026-10-08T19:57:29-06:00|emoralesm37|feat: integrar evaluacion de lecturas con reglas activas RF-ADM-32.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/integration/fase3-unificada

Punta: 94e4998|2026-10-24T18:23:48Z|Ubuntu|Conectar sensores al Gateway conservando contratos y alertas.

Sin commits exclusivos respecto de HEAD. Contenido hist?rico ya incorporado; no hay mejora nueva por integrar desde esta rama.

### origin/main

Punta: c26a72d|2026-11-06T02:40:26-06:00|emoralesm37|Merge pull request #58 from emoralesm37/Pruebas.

Commits exclusivos de la rama (incluye merges y trabajo heredado de otras ramas):

- c26a72d ? 2026-11-06T02:40:26-06:00 ? emoralesm37 ? Merge pull request #58 from emoralesm37/Pruebas
- df3d48a ? 2026-11-06T02:38:34-06:00 ? emoralesm37 ? Merge pull request #57 from emoralesm37/Dev
- d72b09a ? 2026-11-06T02:35:28-06:00 ? emoralesm37 ? Merge pull request #56 from emoralesm37/feature/fase3-edwin-microservices
- 00a794c ? 2026-11-06T02:32:51-06:00 ? emoralesm37 ? Merge branch 'Dev' into feature/fase3-edwin-microservices
- 2e9067b ? 2026-11-06T02:23:04-06:00 ? emoralesm37 ? Merge remote-tracking branch 'origin/main' into feature/fase3-edwin-microservices
- 198136e ? 2026-11-06T02:18:44-06:00 ? emoralesm37 ? feat(audit): implement audit service and gateway integration
- f45c2a1 ? 2026-11-05T23:22:20-06:00 ? julietapinto ? Merge pull request #55 from emoralesm37/feature/fase4-auth-claims-tests
- 5e1c69e ? 2026-11-05T23:21:10-06:00 ? julietapinto ? feat(auth): add JWT claims and OAuth callback tests
- bbb2b58 ? 2026-11-05T22:12:04-06:00 ? julietapinto ? Merge pull request #54 from emoralesm37/feature/fase4-auth-oauth
- a8be7b7 ? 2026-11-05T22:10:08-06:00 ? julietapinto ? Google and GitHub OAuth login
- d3a083e ? 2026-11-05T21:55:08-06:00 ? emoralesm37 ? Merge pull request #53 from emoralesm37/Pruebas
- be0f66d ? 2026-11-05T21:53:07-06:00 ? emoralesm37 ? Merge pull request #52 from emoralesm37/Dev
- eedc8dd ? 2026-11-05T21:50:00-06:00 ? emoralesm37 ? Merge pull request #51 from emoralesm37/feature/fase3-edwin-microservices
- ca4a3dd ? 2026-11-05T21:37:49-06:00 ? emoralesm37 ? feat(report-service): implement RF-REP-03 reporte lecturas (parcial)
- 1b3f193 ? 2026-11-05T18:42:50-06:00 ? emoralesm37 ? feat(report): complete RF-REP reporte sensores e integracion
- 24b1906 ? 2026-11-05T11:42:17-06:00 ? emoralesm37 ? feat(report-service): implementa reporte de sensores RF-REP-02 y pruebas
- 9dbb036 ? 2026-11-05T09:21:43-06:00 ? emoralesm37 ? feat(report-service): agrega seguridad JWT, reportes de comunidades, historial y descarga PDF
- 693ade2 ? 2026-11-04T22:10:06-06:00 ? julietapinto ? Merge pull request #50 from emoralesm37/feature/fase3-alert-rules
- 54b9ef9 ? 2026-11-04T22:09:14-06:00 ? julietapinto ? Agregar reglas, evaluación y prevención de duplicados
- 0b065c2 ? 2026-11-04T21:33:00-06:00 ? julietapinto ? Merge pull request #49 from emoralesm37/feature/fase3-alert-service
- e60c17b ? 2026-11-04T21:29:16-06:00 ? julietapinto ? Implementar microservicio de alertas con JWT y PostgreSQL
- 6b66b26 ? 2026-11-04T02:01:50-06:00 ? emoralesm37 ? feat: agrego infra de MongoDB y servicio de reportes
- c10ea15 ? 2026-11-02T22:33:42-06:00 ? julietapinto ? Merge pull request #48 from emoralesm37/feature/fase3-community-service
- b7076b8 ? 2026-11-02T22:21:45-06:00 ? julietapinto ? feat(comunidades): agregar contenedor y configuración de entorno
- 956647a ? 2026-11-02T21:57:43-06:00 ? julietapinto ? fix(comunidades): corregir JWT, consultas y agregar pruebas
- 46370e8 ? 2026-11-02T20:27:53-06:00 ? julietapinto ? avance(comunidades): crear microservicio con PostgreSQL y JWT

Archivos cambiados desde merge-base:

```text
M	.gitignore
M	gateway/ClimateGuard.Gateway/appsettings.json
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

Riesgo de colisi?n con archivos pendientes:

- .gitignore (revisar diferencia; no sobrescribir)
- infrastructure/mongodb/create-users.sh (revisar diferencia; no sobrescribir)
- services/alert-service/.dockerignore (revisar diferencia; no sobrescribir)
- services/alert-service/Dockerfile (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java (revisar diferencia; no sobrescribir)
- services/alert-service/src/main/resources/application.properties (revisar diferencia; no sobrescribir)
- services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java (revisar diferencia; no sobrescribir)
- services/audit-service/app/main.py (revisar diferencia; no sobrescribir)
- services/audit-service/requirements.txt (revisar diferencia; no sobrescribir)
- services/auth-service/src/app.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.module.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/auth.service.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/entities/external-account.entity.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/auth/interfaces/external-profile.interface.ts (contenido id?ntico)
- services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts (revisar diferencia; no sobrescribir)
- services/auth-service/src/users/entities/user.entity.ts (revisar diferencia; no sobrescribir)

## Comparaci?n de contenido y archivos de puntas hist?ricas

Se compararon blobs con el archivo local, incluyendo archivos nuevos sin seguimiento. Id?ntico significa igualdad byte a byte; diferente requiere revisi?n sem?ntica y no prueba un conflicto textual. No se ley? contenido de archivos de configuraci?n excluidos.

La ?nica copia previa que cambi? tras el respaldo es auth.service.spec.ts (dos pruebas autorizadas). Ning?n archivo respaldado falta; las cinco configuraciones excluidas siguen presentes. No hubo modificaciones de implementaci?n adicionales en este turno: las mejoras OAuth de Julieta ya estaban adaptadas.

main, Dev y Pruebas tienen el mismo conjunto de 96 paths modificados desde su merge-base: 49 id?nticos al ?rbol local, 26 diferentes, 15 ausentes y 6 configuraciones excluidas. La rama de Edwin a?ade dos commits sobre main, aunque modifica paths ya presentes en ese conjunto. Las ausencias incluyen estrategias Passport deliberadamente reemplazadas y componentes remotos de auditor?a con arquitectura distinta; no todas son funcionalidades faltantes.

### origin/Dev ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| .gitignore | different-review-required |
| gateway/ClimateGuard.Gateway/appsettings.json | configuration-not-read |
| infrastructure/mongodb/create-users.sh | different-review-required |
| infrastructure/mongodb/docker-compose.yml | identical |
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/audit-service/app/config.py | absent-locally |
| services/audit-service/app/database.py | absent-locally |
| services/audit-service/app/main.py | different-review-required |
| services/audit-service/app/models.py | absent-locally |
| services/audit-service/app/repository.py | absent-locally |
| services/audit-service/app/security.py | absent-locally |
| services/audit-service/requirements.txt | different-review-required |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/audit-client.service.ts | absent-locally |
| services/auth-service/src/auth/auth.controller.spec.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |
| services/report-service/app/community_client.py | different-review-required |
| services/report-service/app/community_mapper.py | identical |
| services/report-service/app/config.py | different-review-required |
| services/report-service/app/database.py | identical |
| services/report-service/app/main.py | different-review-required |
| services/report-service/app/models.py | identical |
| services/report-service/app/pdf_generator.py | different-review-required |
| services/report-service/app/reading_filters.py | absent-locally |
| services/report-service/app/reading_status.py | absent-locally |
| services/report-service/app/report_download.py | identical |
| services/report-service/app/report_service.py | different-review-required |
| services/report-service/app/repository.py | identical |
| services/report-service/app/security.py | identical |
| services/report-service/app/sensor_client.py | absent-locally |
| services/report-service/app/sensor_mapper.py | absent-locally |
| services/report-service/app/templates/communities.html | identical |
| services/report-service/app/templates/readings.html | absent-locally |
| services/report-service/app/templates/sensors.html | absent-locally |
| services/report-service/requirements.txt | identical |
| services/report-service/tests/test_report_mappers.py | absent-locally |

### origin/Pruebas ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| .gitignore | different-review-required |
| gateway/ClimateGuard.Gateway/appsettings.json | configuration-not-read |
| infrastructure/mongodb/create-users.sh | different-review-required |
| infrastructure/mongodb/docker-compose.yml | identical |
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/audit-service/app/config.py | absent-locally |
| services/audit-service/app/database.py | absent-locally |
| services/audit-service/app/main.py | different-review-required |
| services/audit-service/app/models.py | absent-locally |
| services/audit-service/app/repository.py | absent-locally |
| services/audit-service/app/security.py | absent-locally |
| services/audit-service/requirements.txt | different-review-required |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/audit-client.service.ts | absent-locally |
| services/auth-service/src/auth/auth.controller.spec.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |
| services/report-service/app/community_client.py | different-review-required |
| services/report-service/app/community_mapper.py | identical |
| services/report-service/app/config.py | different-review-required |
| services/report-service/app/database.py | identical |
| services/report-service/app/main.py | different-review-required |
| services/report-service/app/models.py | identical |
| services/report-service/app/pdf_generator.py | different-review-required |
| services/report-service/app/reading_filters.py | absent-locally |
| services/report-service/app/reading_status.py | absent-locally |
| services/report-service/app/report_download.py | identical |
| services/report-service/app/report_service.py | different-review-required |
| services/report-service/app/repository.py | identical |
| services/report-service/app/security.py | identical |
| services/report-service/app/sensor_client.py | absent-locally |
| services/report-service/app/sensor_mapper.py | absent-locally |
| services/report-service/app/templates/communities.html | identical |
| services/report-service/app/templates/readings.html | absent-locally |
| services/report-service/app/templates/sensors.html | absent-locally |
| services/report-service/requirements.txt | identical |
| services/report-service/tests/test_report_mappers.py | absent-locally |

### origin/edwin-backend-integration ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	backend/ClimateGuard.Application/Abstractions/Alerts/IAlertGenerationService.cs
M	backend/ClimateGuard.Infrastructure/DependencyInjection.cs
A	backend/ClimateGuard.Infrastructure/Services/Alerts/AlertGenerationService.cs
M	backend/ClimateGuard.Infrastructure/Services/Sensors/SensorService.cs
```

### origin/edwin-docker-database ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	.env.example
M	.gitignore
M	docker-compose.yml
M	docker/db_init/init-database.sh
```

### origin/feature/backend-configuration ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	backend/ClimateGuard.Api/ClimateGuard.Api.csproj
D	backend/ClimateGuard.Api/Controllers/WeatherForecastController.cs
A	backend/ClimateGuard.Api/Exceptions/GlobalExceptionHandler.cs
M	backend/ClimateGuard.Api/Program.cs
D	backend/ClimateGuard.Api/WeatherForecast.cs
M	backend/ClimateGuard.Api/appsettings.json
```

### origin/feature/backend-infraestructura ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	.env.example
A	.gitignore
A	README.md
A	backend/ClimateGuard.Api/ClimateGuard.Api.csproj
A	backend/ClimateGuard.Api/ClimateGuard.Api.http
A	backend/ClimateGuard.Api/Controllers/WeatherForecastController.cs
A	backend/ClimateGuard.Api/Program.cs
A	backend/ClimateGuard.Api/Properties/launchSettings.json
A	backend/ClimateGuard.Api/WeatherForecast.cs
A	backend/ClimateGuard.Api/appsettings.Development.json
A	backend/ClimateGuard.Api/appsettings.json
A	backend/ClimateGuard.Application/Class1.cs
A	backend/ClimateGuard.Application/ClimateGuard.Application.csproj
A	backend/ClimateGuard.Domain/Class1.cs
A	backend/ClimateGuard.Domain/ClimateGuard.Domain.csproj
A	backend/ClimateGuard.Infrastructure/Class1.cs
A	backend/ClimateGuard.Infrastructure/ClimateGuard.Infrastructure.csproj
A	backend/ClimateGuard.sln
A	database/ClimateGuard.sql
A	docker-compose.yml
A	docs/.gitkeep
A	frontend/.gitkeep
```

### origin/feature/communities-catalogs ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	backend/ClimateGuard.Api/Controllers/CatalogsController.cs
A	backend/ClimateGuard.Api/Controllers/CommunitiesController.cs
```

### origin/feature/domain-persistence ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	backend/ClimateGuard.Api/ClimateGuard.Api.csproj
M	backend/ClimateGuard.Api/Program.cs
A	backend/ClimateGuard.Infrastructure/DependencyInjection.cs
```

### origin/feature/fase2-comunidades-sensores ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	backend/ClimateGuard.Api/Controllers/CommunitiesController.cs
M	backend/ClimateGuard.Application/Abstractions/Communities/ICommunityService.cs
A	backend/ClimateGuard.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
M	backend/ClimateGuard.Application/Contracts/Communities/CommunityDto.cs
A	backend/ClimateGuard.Application/Contracts/Communities/CommunityFilterRequest.cs
M	backend/ClimateGuard.Application/Contracts/Communities/CreateCommunityRequest.cs
M	backend/ClimateGuard.Application/Contracts/Communities/UpdateCommunityRequest.cs
M	backend/ClimateGuard.Domain/Entities/Community.cs
A	backend/ClimateGuard.Infrastructure/Migrations/20261007050429_ExpandCommunityAdministration.Designer.cs
A	backend/ClimateGuard.Infrastructure/Migrations/20261007050429_ExpandCommunityAdministration.cs
M	backend/ClimateGuard.Infrastructure/Migrations/AppDbContextModelSnapshot.cs
M	backend/ClimateGuard.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
M	backend/ClimateGuard.Infrastructure/Services/Communities/CommunityService.cs
M	database/ClimateGuard.sql
```

### origin/feature/fase3-alert-rules ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |

### origin/feature/fase3-alert-service ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |

### origin/feature/fase3-auth-completion ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	services/auth-service/.dockerignore
M	services/auth-service/.env.example
A	services/auth-service/Dockerfile
A	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.module.ts
A	services/auth-service/src/auth/decorators/roles.decorator.ts
A	services/auth-service/src/auth/guards/jwt-auth.guard.ts
A	services/auth-service/src/auth/guards/roles.guard.spec.ts
A	services/auth-service/src/auth/guards/roles.guard.ts
A	services/auth-service/src/auth/interfaces/authenticated-user.interface.ts
A	services/auth-service/src/auth/strategies/jwt.strategy.ts
A	services/auth-service/src/roles/dto/role-response.dto.ts
M	services/auth-service/src/roles/roles.controller.ts
M	services/auth-service/src/roles/roles.module.ts
M	services/auth-service/src/roles/roles.service.ts
A	services/auth-service/src/users/dto/change-user-status-request.dto.ts
A	services/auth-service/src/users/dto/create-user-request.dto.ts
A	services/auth-service/src/users/dto/update-user-request.dto.ts
A	services/auth-service/src/users/dto/user-response.dto.ts
M	services/auth-service/src/users/users.controller.ts
M	services/auth-service/src/users/users.module.ts
M	services/auth-service/src/users/users.service.ts
```

### origin/feature/fase3-auth-service ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.service.ts
```

### origin/feature/fase3-community-service ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |

### origin/feature/fase3-edwin-microservices ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| .gitignore | different-review-required |
| gateway/ClimateGuard.Gateway/appsettings.json | configuration-not-read |
| infrastructure/mongodb/create-users.sh | different-review-required |
| infrastructure/mongodb/docker-compose.yml | identical |
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/audit-service/app/config.py | absent-locally |
| services/audit-service/app/database.py | absent-locally |
| services/audit-service/app/main.py | different-review-required |
| services/audit-service/app/models.py | absent-locally |
| services/audit-service/app/repository.py | absent-locally |
| services/audit-service/app/security.py | absent-locally |
| services/audit-service/requirements.txt | different-review-required |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/audit-client.service.ts | absent-locally |
| services/auth-service/src/auth/auth.controller.spec.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |
| services/report-service/app/community_client.py | different-review-required |
| services/report-service/app/community_mapper.py | identical |
| services/report-service/app/config.py | different-review-required |
| services/report-service/app/database.py | identical |
| services/report-service/app/main.py | different-review-required |
| services/report-service/app/models.py | identical |
| services/report-service/app/pdf_generator.py | different-review-required |
| services/report-service/app/reading_filters.py | absent-locally |
| services/report-service/app/reading_status.py | absent-locally |
| services/report-service/app/report_download.py | identical |
| services/report-service/app/report_service.py | different-review-required |
| services/report-service/app/repository.py | identical |
| services/report-service/app/security.py | identical |
| services/report-service/app/sensor_client.py | absent-locally |
| services/report-service/app/sensor_mapper.py | absent-locally |
| services/report-service/app/templates/communities.html | identical |
| services/report-service/app/templates/readings.html | absent-locally |
| services/report-service/app/templates/sensors.html | absent-locally |
| services/report-service/requirements.txt | identical |
| services/report-service/tests/test_report_mappers.py | absent-locally |

### origin/feature/fase4-auth-claims-tests ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| .gitignore | different-review-required |
| infrastructure/mongodb/create-users.sh | different-review-required |
| infrastructure/mongodb/docker-compose.yml | identical |
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.spec.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |
| services/report-service/app/community_client.py | different-review-required |
| services/report-service/app/community_mapper.py | identical |
| services/report-service/app/config.py | different-review-required |
| services/report-service/app/database.py | identical |
| services/report-service/app/main.py | different-review-required |
| services/report-service/app/models.py | identical |
| services/report-service/app/pdf_generator.py | different-review-required |
| services/report-service/app/reading_filters.py | absent-locally |
| services/report-service/app/reading_status.py | absent-locally |
| services/report-service/app/report_download.py | identical |
| services/report-service/app/report_service.py | different-review-required |
| services/report-service/app/repository.py | identical |
| services/report-service/app/security.py | identical |
| services/report-service/app/sensor_client.py | absent-locally |
| services/report-service/app/sensor_mapper.py | absent-locally |
| services/report-service/app/templates/communities.html | identical |
| services/report-service/app/templates/readings.html | absent-locally |
| services/report-service/app/templates/sensors.html | absent-locally |
| services/report-service/requirements.txt | identical |
| services/report-service/tests/test_report_mappers.py | absent-locally |

### origin/feature/fase4-auth-oauth ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |

### origin/feature/frontend-angular ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	.dockerignore
M	frontend/src/app/features/dashboard/dashboard.ts
A	infrastructure/compose/compose.local.yml
A	infrastructure/nginx/nginx.conf
```

### origin/feature/sensor-contracts ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	backend/ClimateGuard.Api/Controllers/SensorsController.cs
M	backend/ClimateGuard.Api/Exceptions/GlobalExceptionHandler.cs
```

### origin/fix/api-integration-validation ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	backend/ClimateGuard.Application/Contracts/Communities/CreateCommunityRequest.cs
M	backend/ClimateGuard.Application/Contracts/Communities/UpdateCommunityRequest.cs
M	backend/ClimateGuard.Application/Contracts/Sensors/CreateSensorRequest.cs
M	backend/ClimateGuard.Application/Contracts/Sensors/UpdateSensorRequest.cs
M	backend/ClimateGuard.Infrastructure/Services/Sensors/SensorService.cs
```

### origin/fix/sensor-query-ordering ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	backend/ClimateGuard.Infrastructure/Services/Sensors/SensorService.cs
```

### origin/integration/entrega-final ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
A	backend/ClimateGuard.Application/Abstractions/Alerts/IAlertEvaluationService.cs
M	backend/ClimateGuard.Infrastructure/DependencyInjection.cs
A	backend/ClimateGuard.Infrastructure/Services/Alerts/AlertEvaluationService.cs
M	backend/ClimateGuard.Infrastructure/Services/Sensors/SensorService.cs
```

### origin/integration/fase3-unificada ? contenido

Archivos del commit de punta (si es merge, diferencias por padre; pueden repetirse):

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
M	services/sensor-service/ClimateGuard.Sensor.Api/ClimateGuard.Sensor.Api.csproj
M	services/sensor-service/ClimateGuard.Sensor.Api/Program.cs
A	services/sensor-service/tests/ClimateGuard.Sensor.Tests/CompatibilityTests.cs
```

### origin/main ? contenido

| Archivo | Comparaci?n con local |
|---|---|
| .gitignore | different-review-required |
| gateway/ClimateGuard.Gateway/appsettings.json | configuration-not-read |
| infrastructure/mongodb/create-users.sh | different-review-required |
| infrastructure/mongodb/docker-compose.yml | identical |
| services/alert-service/.dockerignore | different-review-required |
| services/alert-service/.env.example | configuration-not-read |
| services/alert-service/.gitattributes | identical |
| services/alert-service/.gitignore | identical |
| services/alert-service/.mvn/wrapper/maven-wrapper.properties | identical |
| services/alert-service/Dockerfile | different-review-required |
| services/alert-service/mvnw | identical |
| services/alert-service/mvnw.cmd | identical |
| services/alert-service/pom.xml | identical |
| services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java | different-review-required |
| services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java | identical |
| services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java | different-review-required |
| services/alert-service/src/main/resources/application.properties | different-review-required |
| services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql | identical |
| services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java | identical |
| services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java | different-review-required |
| services/alert-service/src/test/resources/application.properties | identical |
| services/audit-service/app/config.py | absent-locally |
| services/audit-service/app/database.py | absent-locally |
| services/audit-service/app/main.py | different-review-required |
| services/audit-service/app/models.py | absent-locally |
| services/audit-service/app/repository.py | absent-locally |
| services/audit-service/app/security.py | absent-locally |
| services/audit-service/requirements.txt | different-review-required |
| services/auth-service/.env.example | configuration-not-read |
| services/auth-service/package-lock.json | different-review-required |
| services/auth-service/package.json | different-review-required |
| services/auth-service/src/app.module.ts | different-review-required |
| services/auth-service/src/auth/audit-client.service.ts | absent-locally |
| services/auth-service/src/auth/auth.controller.spec.ts | different-review-required |
| services/auth-service/src/auth/auth.controller.ts | different-review-required |
| services/auth-service/src/auth/auth.module.ts | different-review-required |
| services/auth-service/src/auth/auth.service.ts | different-review-required |
| services/auth-service/src/auth/entities/external-account.entity.ts | different-review-required |
| services/auth-service/src/auth/interfaces/external-profile.interface.ts | identical |
| services/auth-service/src/auth/strategies/github.strategy.ts | absent-locally |
| services/auth-service/src/auth/strategies/google.strategy.ts | absent-locally |
| services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts | different-review-required |
| services/auth-service/src/users/entities/user.entity.ts | different-review-required |
| services/community-service/.dockerignore | identical |
| services/community-service/.env.example | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj | identical |
| services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Program.cs | identical |
| services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json | identical |
| services/community-service/ClimateGuard.Community.Api/appsettings.Development.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Api/appsettings.json | configuration-not-read |
| services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs | identical |
| services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj | identical |
| services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs | identical |
| services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs | identical |
| services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj | identical |
| services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs | identical |
| services/community-service/ClimateGuard.Community.slnx | identical |
| services/community-service/Dockerfile | identical |
| services/report-service/app/community_client.py | different-review-required |
| services/report-service/app/community_mapper.py | identical |
| services/report-service/app/config.py | different-review-required |
| services/report-service/app/database.py | identical |
| services/report-service/app/main.py | different-review-required |
| services/report-service/app/models.py | identical |
| services/report-service/app/pdf_generator.py | different-review-required |
| services/report-service/app/reading_filters.py | absent-locally |
| services/report-service/app/reading_status.py | absent-locally |
| services/report-service/app/report_download.py | identical |
| services/report-service/app/report_service.py | different-review-required |
| services/report-service/app/repository.py | identical |
| services/report-service/app/security.py | identical |
| services/report-service/app/sensor_client.py | absent-locally |
| services/report-service/app/sensor_mapper.py | absent-locally |
| services/report-service/app/templates/communities.html | identical |
| services/report-service/app/templates/readings.html | absent-locally |
| services/report-service/app/templates/sensors.html | absent-locally |
| services/report-service/requirements.txt | identical |
| services/report-service/tests/test_report_mappers.py | absent-locally |


## Archivos por commit exclusivo remoto

Para auditar cada cambio por autor/fecha de las listas anteriores:

### d72b09a

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
```

### 00a794c

```text
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
```

### 2e9067b

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
```

### 198136e

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
```

### f45c2a1

```text
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.service.ts
```

### 5e1c69e

```text
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.service.ts
```

### bbb2b58

```text
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

### a8be7b7

```text
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
```

### d3a083e

```text
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

### be0f66d

```text
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
```

### eedc8dd

```text
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
A	services/report-service/app/report_download.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/security.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/communities.html
A	services/report-service/app/templates/readings.html
A	services/report-service/app/templates/sensors.html
A	services/report-service/requirements.txt
A	services/report-service/tests/test_report_mappers.py
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

### ca4a3dd

```text
M	services/report-service/app/config.py
M	services/report-service/app/main.py
M	services/report-service/app/pdf_generator.py
A	services/report-service/app/reading_filters.py
A	services/report-service/app/reading_status.py
M	services/report-service/app/report_service.py
M	services/report-service/app/sensor_client.py
A	services/report-service/app/templates/readings.html
```

### 1b3f193

```text
M	services/report-service/app/community_client.py
M	services/report-service/app/main.py
M	services/report-service/app/report_service.py
M	services/report-service/app/sensor_client.py
M	services/report-service/app/sensor_mapper.py
M	services/report-service/app/templates/sensors.html
```

### 24b1906

```text
M	services/report-service/app/config.py
M	services/report-service/app/main.py
M	services/report-service/app/pdf_generator.py
M	services/report-service/app/report_service.py
A	services/report-service/app/sensor_client.py
A	services/report-service/app/sensor_mapper.py
A	services/report-service/app/templates/sensors.html
A	services/report-service/tests/test_report_mappers.py
```

### 9dbb036

```text
A	services/report-service/app/community_client.py
A	services/report-service/app/community_mapper.py
M	services/report-service/app/config.py
M	services/report-service/app/main.py
A	services/report-service/app/report_download.py
M	services/report-service/app/report_service.py
M	services/report-service/app/repository.py
A	services/report-service/app/security.py
```

### 693ade2

```text
M	services/alert-service/.dockerignore
M	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
M	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
M	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
M	services/alert-service/src/main/resources/application.properties
M	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
```

### 54b9ef9

```text
M	services/alert-service/.dockerignore
M	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/SensorReadingType.java
M	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
M	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
M	services/alert-service/src/main/resources/application.properties
M	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
```

### 0b065c2

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
```

### e60c17b

```text
A	services/alert-service/.dockerignore
A	services/alert-service/.env.example
A	services/alert-service/.gitattributes
A	services/alert-service/.gitignore
A	services/alert-service/.mvn/wrapper/maven-wrapper.properties
A	services/alert-service/Dockerfile
A	services/alert-service/mvnw
A	services/alert-service/mvnw.cmd
A	services/alert-service/pom.xml
A	services/alert-service/src/main/java/com/climateguard/alert/AlertServiceApplication.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
A	services/alert-service/src/main/java/com/climateguard/alert/api/ApiExceptionHandler.java
A	services/alert-service/src/main/java/com/climateguard/alert/config/SecurityConfig.java
A	services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
A	services/alert-service/src/main/java/com/climateguard/alert/repository/AlertRepository.java
A	services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
A	services/alert-service/src/main/resources/application.properties
A	services/alert-service/src/main/resources/db/migration/V1__create_alerts_table.sql
A	services/alert-service/src/test/java/com/climateguard/alert/AlertServiceApplicationTests.java
A	services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
A	services/alert-service/src/test/resources/application.properties
```

### 6b66b26

```text
M	.gitignore
A	infrastructure/mongodb/create-users.sh
A	infrastructure/mongodb/docker-compose.yml
A	services/report-service/app/config.py
A	services/report-service/app/database.py
A	services/report-service/app/main.py
A	services/report-service/app/models.py
A	services/report-service/app/pdf_generator.py
A	services/report-service/app/report_service.py
A	services/report-service/app/repository.py
A	services/report-service/app/templates/communities.html
A	services/report-service/requirements.txt
```

### c10ea15

```text
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
A	services/community-service/ClimateGuard.Community.slnx
A	services/community-service/Dockerfile
```

### b7076b8

```text
A	services/community-service/.dockerignore
A	services/community-service/.env.example
A	services/community-service/Dockerfile
```

### 956647a

```text
M	services/community-service/ClimateGuard.Community.Api/Program.cs
M	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/CommunityServiceTests.cs
```

### 46370e8

```text
A	services/community-service/ClimateGuard.Community.Api/ClimateGuard.Community.Api.csproj
A	services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
A	services/community-service/ClimateGuard.Community.Api/Program.cs
A	services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.Development.json
A	services/community-service/ClimateGuard.Community.Api/appsettings.json
A	services/community-service/ClimateGuard.Community.Application/Abstractions/Communities/ICommunityService.cs
A	services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/ChangeCommunityStatusRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityFilterRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CreateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Application/Contracts/Communities/UpdateCommunityRequest.cs
A	services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
A	services/community-service/ClimateGuard.Community.Domain/Entities/Community.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/CommunityDbContext.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Configurations/CommunityConfiguration.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
A	services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
A	services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
A	services/community-service/ClimateGuard.Community.slnx
```

### df3d48a

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
```

### 5304a4c

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
M	services/auth-service/src/auth/auth.service.ts
```

### c26a72d

```text
M	gateway/ClimateGuard.Gateway/appsettings.json
A	services/audit-service/app/config.py
A	services/audit-service/app/database.py
A	services/audit-service/app/main.py
A	services/audit-service/app/models.py
A	services/audit-service/app/repository.py
A	services/audit-service/app/security.py
A	services/audit-service/requirements.txt
M	services/auth-service/.env.example
M	services/auth-service/package-lock.json
M	services/auth-service/package.json
M	services/auth-service/src/app.module.ts
A	services/auth-service/src/auth/audit-client.service.ts
M	services/auth-service/src/auth/auth.controller.spec.ts
M	services/auth-service/src/auth/auth.controller.ts
M	services/auth-service/src/auth/auth.module.ts
M	services/auth-service/src/auth/auth.service.ts
A	services/auth-service/src/auth/entities/external-account.entity.ts
A	services/auth-service/src/auth/interfaces/external-profile.interface.ts
A	services/auth-service/src/auth/strategies/github.strategy.ts
A	services/auth-service/src/auth/strategies/google.strategy.ts
A	services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
M	services/auth-service/src/users/entities/user.entity.ts
```


# Revision requerida antes de integrar main

Este PR conserva el trabajo local terminado sobre el ancestro comun. No reemplaza la rama main ni sus cambios posteriores. La integracion automatica no es segura: hay 44 archivos con conflictos.

Base main revisada: `c26a72d4c40d0a82f60f9ccf30ac2629f1a24a58`.

Preparar una rama nueva desde origin/main y fusionar normalmente la rama del PR. Resolver en conjunto contratos JWT/OAuth, migraciones Community, clientes de Report, reglas Alert y configuracion Gateway. Conservar los cambios de ambos lados y repetir pruebas de API, permisos y migraciones con bases de prueba. No aceptar masivamente ours/theirs. No usar reset ni force push. Este PR debe permanecer en borrador hasta completar esa revision.

```text
.gitignore
gateway/ClimateGuard.Gateway/appsettings.json
infrastructure/mongodb/create-users.sh
services/alert-service/.dockerignore
services/alert-service/.env.example
services/alert-service/Dockerfile
services/alert-service/src/main/java/com/climateguard/alert/api/AlertController.java
services/alert-service/src/main/java/com/climateguard/alert/domain/Alert.java
services/alert-service/src/main/java/com/climateguard/alert/service/AlertService.java
services/alert-service/src/main/resources/application.properties
services/alert-service/src/test/java/com/climateguard/alert/api/AlertControllerTests.java
services/audit-service/app/main.py
services/audit-service/requirements.txt
services/auth-service/.env.example
services/auth-service/src/app.module.ts
services/auth-service/src/auth/auth.module.ts
services/auth-service/src/auth/auth.service.ts
services/auth-service/src/auth/entities/external-account.entity.ts
services/auth-service/src/database/migrations/1793937600000-AddExternalAuthentication.ts
services/community-service/.env.example
services/community-service/ClimateGuard.Community.Api/Controllers/CommunitiesController.cs
services/community-service/ClimateGuard.Community.Api/Program.cs
services/community-service/ClimateGuard.Community.Api/Properties/launchSettings.json
services/community-service/ClimateGuard.Community.Api/appsettings.json
services/community-service/ClimateGuard.Community.Application/ClimateGuard.Community.Application.csproj
services/community-service/ClimateGuard.Community.Application/Contracts/Communities/CommunityDto.cs
services/community-service/ClimateGuard.Community.Domain/ClimateGuard.Community.Domain.csproj
services/community-service/ClimateGuard.Community.Infrastructure/ClimateGuard.Community.Infrastructure.csproj
services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.Designer.cs
services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/20261029033106_InitialCommunitySchema.cs
services/community-service/ClimateGuard.Community.Infrastructure/Persistence/Migrations/CommunityDbContextModelSnapshot.cs
services/community-service/ClimateGuard.Community.Infrastructure/Services/Communities/CommunityService.cs
services/community-service/ClimateGuard.Community.Tests/ClimateGuard.Community.Tests.csproj
services/report-service/app/community_client.py
services/report-service/app/config.py
services/report-service/app/database.py
services/report-service/app/main.py
services/report-service/app/pdf_generator.py
services/report-service/app/report_service.py
services/report-service/app/repository.py
services/report-service/app/security.py
services/report-service/app/sensor_client.py
services/report-service/app/templates/readings.html
services/report-service/app/templates/sensors.html
```

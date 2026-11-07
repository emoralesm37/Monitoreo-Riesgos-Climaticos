# Inventario verificado en código

Los puertos de desarrollo no se reutilizan como `localhost` dentro de Pods. Todos los Services de aplicación son ClusterIP. Solo Angular y Gateway son destinos del Ingress.

| Componente | Código / Docker real | Desarrollo → contenedor | Dependencias / estado |
| --- | --- | --- | --- |
| Angular | `frontend/angular.json`, `environment.production.ts`; nuevo `images/frontend.Dockerfile` | 4200 → 8080 Nginx | Producción ya usa `/api`; SPA fallback, `/healthz`, sin claves en bundle |
| Gateway | `gateway/ClimateGuard.Gateway/Program.cs`, `AuditDelivery.cs`; `images/gateway.Dockerfile` | 5147 → 8080 | JWT, CORS, rate limiter, YARP y cola de auditoría en disco |
| Auth | `services/auth-service/src/app.module.ts`, `src/health`, Dockerfile original y variante `images/auth-service.Dockerfile` | 7101 → 7101 | PostgreSQL; sincronización/migración automática desactivada; bcrypt, JWT/refresh y locks de usuarios en BD |
| Backend compatible | `backend/ClimateGuard.Api`, `backend/ClimateGuard.Infrastructure`; nuevo `images/legacy-api.Dockerfile` | 7000 → 8080 | SQL Server: comunidades con `sensorCount`, catálogos y reglas; no hay Dockerfile propio anterior |
| Sensor | `services/sensor-service/ClimateGuard.Sensor.Api/Program.cs`, referencias al backend en csproj; nuevo `images/sensor-service.Dockerfile` | 5026 shared / 7102 independiente → 8080 | Perfil K8s explícito shared-database, SQL Server y entrega a Alert a través de Gateway; se conserva el modo independiente en el código |
| Alert | `services/alert-service/Dockerfile`, `application.properties`, `SecurityConfig`, migraciones V1/V2; variante `images/alert-service.Dockerfile` | 7301 → 7301 | Java 17, PostgreSQL, Flyway y consultas seguras de reglas en legacy; variante elimina fallback de contraseña de desarrollo sin tocar fuentes |
| Report | `services/report-service/Dockerfile`, config, pdf_generator y report_download | 8000 → 8000 | Imagen local ya probada con WeasyPrint; Py3.12/Pango/Cairo/GObject/fuentes; MongoDB + comunidades vía Gateway + directorio PDF |
| Audit | `services/audit-service/Dockerfile`, `app/main.py` | 8001 → 8001 | Imagen local healthy; Py3.12/MongoDB, JWT para consultas, HMAC privado de Gateway para registro |
| Community independiente | `services/community-service/Dockerfile`, Controller y CommunityDto | variable → 8080 | .NET/PostgreSQL, no `sensorCount`; preparado en componente inactivo, no sustituye el contrato validado |

## Validación inicial de imágenes (superada por REVIEW-20261106.md)

En Docker local estaban ejecutándose Report, Audit y Alert con sus imágenes `*:local`, además de PostgreSQL, SQL Server y MongoDB. No se extrajeron variables de esos contenedores a Git. Esas imágenes locales no prueban que existan las imágenes `climateguard/<servicio>:candidate` usadas por los manifests ni que estén disponibles en containerd/K3s.

Los nueve Dockerfiles de destino pasaron BuildKit `--check` y la resolución de sus bases. No se construyeron imágenes nuevas, no se publicaron y no se ejecutaron contenedores de prueba. Los Dockerfiles y referencias de runtime están preparados; falta la construcción completa, escaneo y prueba del artefacto final. Las dependencias de las imágenes base y de NuGet/pip con rangos no garantizan builds bit a bit idénticos: registrar digests y lock/SBOM en la release autorizada.

La compilación del exportador/adaptadores conserva las advertencias NU1902/NU1903 preexistentes de `System.Security.Cryptography.Pkcs` 9.0.11; no se cambiaron dependencias de aplicaciones en esta tarea. Revisarlas en el escaneo previo a la release.

Construcción posterior autorizada, desde la raíz (sin push implícito):

```powershell
foreach ($service in @('frontend','gateway','auth-service','legacy-api','sensor-service','alert-service','community-service')) {
  docker build --platform linux/amd64 -f "infrastructure/k8s/images/$service.Dockerfile" -t "climateguard/${service}:candidate" .
}
docker build --platform linux/amd64 -f services/report-service/Dockerfile -t climateguard/report-service:candidate services/report-service
docker build --platform linux/amd64 -f services/audit-service/Dockerfile -t climateguard/audit-service:candidate services/audit-service
```

Publicar en un registro o importar a containerd será una tarea posterior autorizada. Un `docker images` del host no basta para que K3s encuentre la imagen. Se debe capturar digest y revisión de fuentes completa; HEAD actual con cambios pendientes no identifica por sí solo el contenido de una imagen.

## Configuración efectiva del perfil

- Las rutas base Production del Gateway tenían destinos localhost y no contenían las rutas de usuarios, roles, reportes ni auditoría añadidas en Development. `base/config/gateway.json` define todas explícitamente, con DNS de Services y políticas administrativas; auth/users/roles eliminan `/api`, el resto conserva el prefijo. Ingestión de auditoría no se publica.
- `Sensor__UseSharedDatabase=true` se establece en el Deployment, no depende de appsettings.Development. `ConnectionStrings__ClimateGuard` es un Secret compartido únicamente por backend compatible y sensores.
- JWT issuer/audience predeterminados del perfil corresponden a los valores locales comprobados (`ClimateGuard.Auth` / `ClimateGuard.Services`); no se asume que AWS los utilice. La clave es siempre Secret y debe ser coherente en todos los destinos. Auth usa una clave de refresh separada.
- Solo Auth recibe credenciales de PostgreSQL Auth. Solo Alert recibe PostgreSQL Alert. Report y Audit reciben sus usuarios Mongo limitados a sus respectivas bases. Solo Gateway/Audit reciben la clave HMAC.
- Report consulta `http://gateway:8080`, que agrega `/api/communities`; Sensor entrega en `http://gateway:8080/api/alerts/evaluate`; Java consulta `http://legacy-api:8080/api/alert-rules/evaluation` con el Bearer recibido. Se conserva un único motor Java, sin registrar el evaluador SQL antiguo.
- No hay scripts init/migraciones como initContainers en cada réplica. Los Jobs están separados. Flyway de Alert sí está habilitado, según el comportamiento real del servicio, y debe revisarse antes de arrancar contra una base restaurada.

## Probes y qué significan

| Componente | Startup / readiness | Liveness | Límite |
| --- | --- | --- | --- |
| Frontend | `/healthz` / `/index.html` | `/healthz` | No valida llamadas API |
| Gateway | `/health/ready` | `/health` | Readiness verifica escritura del PVC mediante adaptador K8s, no todos los servicios aguas abajo |
| Auth | `/health` con SELECT 1 | TCP 7101 | No reinicia por cada caída de PostgreSQL; salud de conexión no prueba que todas las migraciones existan |
| Legacy | `/health/database` | `/health` | Adaptador K8s comprueba conexión SQL, no la integridad de todas las tablas |
| Sensor | `/health/database` | `/health` | Endpoint ya existe y devuelve 503 sin conexión |
| Alert | `/actuator/health/readiness` | `/actuator/health/liveness` | Readiness incluye `readinessState,db`; Flyway/validate pueden impedir arranque sin esquema |
| Report | `/health/database` | `/health` | No genera PDFs como probe; debe probarse WeasyPrint en smoke test |
| Audit | `/health` con ping Mongo | TCP 8001 | La pérdida de Mongo quita readiness sin provocar reinicios por liveness |
| Bases | TCP hasta 300 s, consulta autenticada de readiness | TCP | No demuestra que los datos de negocio hayan sido restaurados |

Los startups permiten hasta 300 s, no un sleep fijo; timeout 5 s. Se comprobó la existencia de endpoints en código, no se ejecutaron estos probes en Kubernetes. La distinción entre [startup, readiness y liveness](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) evita confundir dependencia caída con proceso muerto.

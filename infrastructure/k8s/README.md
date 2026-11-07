# ClimateGuard: preparación Kubernetes/K3s

> Candidato AWS actualizado: [arquitectura, costo y estado](aws/README.md),
> [ejecución y aprobación de retirada](aws/EXECUTION.md).
> Nueve imágenes locales construidas; ningún cambio AWS ejecutado.
> El laboratorio local sí arrancó parcialmente y quedó detenido por RAM:
> [resultado del reintento](lab-minimal/RESULT-RESUME-20261106.md).
> Las afirmaciones de «no se inició» de la revisión anterior son históricas.

> Revisión actual del 06/11/2026: nueve imágenes construidas y pruebas aisladas
> de runtime completadas. Reportes de sensores/lecturas y componente OAuth revisados.
> Ver [resultado y límites](REVIEW-20261106.md) y [plan local aislado](ISOLATED-K3S.md).
> El clúster no se inició. Las cifras de validación inicial de este documento son
> históricas; la evidencia actual está en `review-evidence-20261106.json`.

**Estado: preparación local validada estáticamente, NO desplegada en Kubernetes ni AWS.** No se modificaron los servicios en ejecución. La [fase 3](https://github.com/melgust/desaweb2026b/blob/main/phase_3.md) pide Compose y preparación para K3s; la migración, Ingress, Secrets y escalabilidad están en la [fase 4](https://github.com/melgust/desaweb2026b/blob/main/phase_4.md).

## Perfiles

| Perfil | Contenido | Estado |
| --- | --- | --- |
| `single-node` | 8 Deployments, 4 StatefulSets de bases nuevas, Services internos, PVC, ConfigMaps, NetworkPolicies, Ingress/TLS | Conserva los contratos Angular actuales; no adopta datos/volúmenes existentes |
| `scalable` | Anterior + HPA de frontend, sensores, alertas y auditoría | Requiere Metrics Server y pruebas reales de carga |
| `community-review` | Compatibilidad + Community Service independiente y su PostgreSQL, ambos con 0 réplicas | Revisión, sin cambiar la ruta de comunidades |
| `jobs` | Provisión y migraciones explícitas, **fuera** del despliegue de aplicaciones | Aplicar individualmente solo tras revisar destino, datos y autorización |

Gateway sigue enviando comunidades, catálogos y reglas al backend compartido; Sensor usa `Sensor:UseSharedDatabase=true`. No se migró la función de comunidades a un DTO que pierde `sensorCount`. No se añadieron configuraciones OAuth inventadas ni se modificó código de Julieta o Edwin.

Inventario y estado de imágenes: [INVENTORY.md](INVENTORY.md). Persistencia y capacidad: [PERSISTENCE.md](PERSISTENCE.md). Secrets: [secrets/README.md](secrets/README.md). Despliegue futuro, comprobaciones SSH y reversión: [RUNBOOK.md](RUNBOOK.md).

## Validar sin clúster, desde PowerShell en la raíz

Se usó el kubectl instalado con Docker Desktop (`v1.36.1`, Kustomize `v5.8.1`). `kubectl kustomize` solo renderiza archivos; no se ejecutaron `apply`, `get nodes`, `cluster-info`, instalación de K3s ni comandos SSH. No se consultó el contexto actual.

```powershell
$py = 'services/report-service/.venv/Scripts/python.exe' # Python/PyYAML ya disponibles localmente
& $py infrastructure/k8s/tools/generate.py
& $py infrastructure/k8s/tools/render.py --profile single-node --domain climateguard.test --output infrastructure/k8s/.rendered/single-node.yaml
& $py infrastructure/k8s/tools/render.py --profile scalable --domain climateguard.test --output infrastructure/k8s/.rendered/scalable.yaml
& $py infrastructure/k8s/tools/render.py --profile community-review --domain climateguard.test --output infrastructure/k8s/.rendered/community-review.yaml
& $py infrastructure/k8s/tools/render.py --profile jobs --domain climateguard.test --output infrastructure/k8s/.rendered/jobs.yaml
& $py -m unittest discover -s infrastructure/k8s/tools -p test_manifests.py -v
```

Para regenerar el DDL si cambia el modelo EF, sin conectarse ni iniciar el backend:

```powershell
dotnet run --project infrastructure/k8s/tools/schema-export/SchemaExport.csproj --artifacts-path "$env:TEMP/cg-k8s-schema-export" -- infrastructure/k8s/jobs/sql-schema.sql
```

El exportador instancia únicamente los metadatos de AppDbContext, usa un destino `.invalid` sin abrirlo y rechaza sentencias de datos o DROP. Los 13 CREATE TABLE generados son estructura, no una restauración de los datos ni de catálogos.

`climateguard.test` es únicamente un parámetro de validación offline. No se creó DNS ni se sustituyó el dominio real. Los templates usan `climateguard.invalid` deliberadamente. Para un despliegue autorizado, renderizar con **el dominio ya existente y verificado**, la clase de Ingress, sus selectores reales, StorageClass y las imágenes construidas:

```powershell
& $py infrastructure/k8s/tools/render.py --profile single-node --domain $dominioVerificado --ingress-class $claseVerificada --controller traefik --ingress-namespace kube-system --ingress-label app.kubernetes.io/name=traefik --tls-secret $secretTlsExistente --storage-class $storageClassVerificada --image-prefix $registroAprobado --tag $versionInmutable --output infrastructure/k8s/.rendered/release.yaml
```

Para Ingress Nginx, usar `--controller nginx` y sus clase/namespace/labels comprobados; no confiar en los valores Traefik predeterminados. Para registro privado, `--image-pull-secret` referencia un Secret ya provisionado, sin crear credenciales. El renderer configura TLS del controlador y CORS del Gateway con el mismo hostname; añade un checksum de configuración a las plantillas de Pods. Cambiar valores de Secrets requiere un rollout autorizado y coordinado aparte.

### Validación OpenAPI totalmente offline

Se descargó únicamente el [swagger oficial v1.36.1](https://raw.githubusercontent.com/kubernetes/kubernetes/v1.36.1/api/openapi-spec/swagger.json) a `%TEMP%`, no un kubeconfig. Las dependencias ligeras `jsonschema` se instalaron con `--target` en `%TEMP%/cg-k8s-validation-deps`, sin cambiar requirements de Report Service. Para otra máquina usar un venv propio y `tools/requirements-validation.txt`.

```powershell
& $py infrastructure/k8s/tools/validate.py infrastructure/k8s/.rendered/single-node.yaml --swagger "$env:TEMP/cg-kubernetes-v1.36.1-swagger.json" --dependencies "$env:TEMP/cg-k8s-validation-deps"
```

Se validaron 76 recursos de `single-node`, 80 de `scalable`, 86 de `community-review` y 7 de `jobs`, con esquemas oficiales y comprobaciones adicionales. El validador respeta `IntOrString` del OpenAPI de Kubernetes y rechaza campos desconocidos en objetos estructurados. Comprueba referencias, Services/puertos, probes, rutas protegidas, PVC, namespaces y HPA; tiene 10 pruebas de seguridad. No verifica admission webhooks, CSI/CNI, TLS real, imágenes publicadas, capacidad, migraciones ejecutadas ni conectividad real.

### Imágenes y adaptación de hosting

Los Dockerfiles nuevos están en `images/`, con contexto **raíz del repositorio** e ignores específicos contra `.env`, claves, PDFs, entornos virtuales y artefactos locales. Report y Audit conservan sus Dockerfiles existentes y contextos propios. Los nuevos Dockerfiles .NET excluyen appsettings versionados y requieren ConfigMaps/env/Secrets explícitos en el contenedor.

Los adaptadores `LegacyHosting.cs` y `GatewayHosting.cs` se compilan solo dentro de las imágenes K8s: no se cambia el código local en ejecución. Agregan readiness de SQL/conexión y escritura real del outbox, respectivamente. El Dockerfile del backend habilita una opción de hosting para no redirigir HTTP interno a un puerto HTTPS inexistente; en Kubernetes el TLS lo termina Ingress. El comportamiento original fuera de la imagen no cambia. El adaptador de Gateway excluye sus probes del rate limiter. Las sustituciones tienen guardas de build para detectar cambios de los puntos de inserción.

Se comprobó `docker build --check` para nueve Dockerfiles, sin warnings. Esto verifica sintaxis/bases accesibles, **no construye ni prueba las imágenes finales**. Se compiló el exportador .NET, incluidos ambos adaptadores, y se generó DDL desde el modelo actual sin abrir una conexión de base de datos. La imagen final, sus permisos de PVC y cada probe deberán probarse en un clúster aislado antes del servidor existente.

## Bloqueos antes de un despliegue real

1. Inventariar AWS y decidir convivencia con Nginx/HTTPS actuales, sin ocupar 80/443 a ciegas.
2. Construir/publicar/importar imágenes de esta revisión y fijar digests; `candidate` no es un artefacto publicado. Los tags base todavía deben fijarse por digest en la revisión de release.
3. Crear Secrets privados y confirmar consistencia de claves, usuarios y destinos. No hay credenciales en los YAML.
4. Restaurar datos aprobados o inicializar bases nuevas mediante los pasos separados; el DDL SQL exportado no incluye catálogos ni datos de negocio ni crea el login SQL de aplicación.
5. Probar PVC/UID, fuentes y PDF con root filesystem de solo lectura; restauración consistente de MongoDB y PDFs.
6. Probar Ingress, TLS, CNI, NetworkPolicies, DNS, Metrics Server y carga. El rate limiting actual del Gateway usa IP de conexión: detrás de Ingress puede agrupar clientes; falta definir proxies confiables/distribución antes de un uso productivo. No se activó confianza indiscriminada de cabeceras forwarded.
7. Community independiente sigue pendiente de `sensorCount`/asociaciones. OAuth/OIDC y reportes adicionales siguen bajo sus responsables.

No se declara Kubernetes operativo ni se modificó AWS. Los resultados están resumidos en `validation-evidence.json`.

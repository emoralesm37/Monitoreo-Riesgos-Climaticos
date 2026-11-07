# Procedimiento futuro: despliegue, reversión y comprobación

**No ejecutado. Requiere una tarea de despliegue autorizada.** Esta preparación no instala K3s, no abre SSH, no modifica AWS, no aplica manifests, no ejecuta Jobs ni cambia los contenedores locales.

## 1. Inventariar el servidor existente antes de decidir el corte

En una sesión SSH autorizada posteriormente, usar consultas de lectura. No copiar claves ni archivos `.env` al informe:

```sh
hostname
uname -m
free -h
df -h
lsblk
ss -lntp
systemctl status nginx caddy docker k3s --no-pager
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}'
```

En **la ruta de repositorio verificada del servidor**, revisar `git branch --show-current`, `git rev-parse HEAD` y `git status --short`. No usar fetch/pull/merge como parte del inventario. No imprimir `git remote -v` si puede contener credenciales. De cada contenedor anotar ID de imagen, digest, fecha y labels de revisión seleccionados; no volcar `.Config.Env` ni `docker compose config` resuelto. Una rama/HEAD del directorio no prueba qué binario está ejecutando un contenedor: contrastar imagen, revisión de build, mounts y configuración de arranque.

Identificar proxy activo (Nginx/Caddy/otro), archivos de configuración y propietarios, puertos 80/443, ruta del certificado y mecanismo de renovación. Consultar metadatos del certificado público sin mostrar la clave privada. Revisar servicios systemd/Compose y volúmenes/discos, dominios virtuales, reglas de red, backups y si ya existe K3s. No publicar dumps ni datos de cuentas.

**No instalar K3s con Traefik/ServiceLB por defecto en el servidor antes de resolver la ocupación de 80/443 por el proxy existente.** No crear otro dominio ni rehacer DNS/TLS. Evaluar mantener el proxy actual como borde hacia el Ingress o planificar un corte coordinado del listener; decidir después del inventario y de probar certificados y rutas. No se han seleccionado puertos nuevos del servidor ni una nueva instancia.

Si ya hay clúster, confirmar por lectura autorizada: versión, contexto, nodos/arquitectura, StorageClass/reclaimPolicy, CSI, CNI/NetworkPolicy, IngressClass/entrypoints/labels reales, Metrics Server, DNS y cifrado de Secrets. Nunca confiar en el contexto predeterminado de kubectl. El schema offline v1.36.1 no demuestra la versión de ese servidor; repetir validación con el OpenAPI compatible y `--dry-run=server` solo en el clúster autorizado. Las API usadas requieren un Kubernetes moderno; no adoptar una versión antigua sin revisar características como retención de PVC.

## 2. Congelar y validar la release en un entorno aislado

1. Acordar revisión de fuentes y coordinar OAuth con Julieta y reportes con Edwin. Los cambios locales actuales no tienen todavía un commit de release autorizado. No atribuir una imagen al HEAD sin incluir también el trabajo pendiente.
2. Construir las imágenes descritas en INVENTORY, probarlas y registrar digests/SBOM/resultado de escaneo. No usar tags mutables como identidad de release; fijar también imágenes base y de bases de datos por digest en la revisión aprobada. Tener credenciales privadas del registro o importación de imágenes a containerd.
3. Renderizar con dominio, clase/controller de Ingress, namespace/labels del controller, StorageClass y registro/tag verificados. El dominio `.test` usado aquí solo sirve para validación local.
4. Validar todos los YAML offline y después admission/server dry-run en el clúster de pruebas autorizado. No se ejecutó ese dry-run en esta tarea.
5. Probar en clúster aislado con datos de prueba aprobados antes de tocar el servicio público. Mantener listeners y datos de AWS sin cambios.

Todos los comandos de clúster siguientes son para una autorización posterior y deben llevar **`--context $contextoVerificado`** y **`-n climateguard`**. No ejecutar bloques completos de manera ciega.

## 3. Orden de un primer arranque aprobado

1. Crear Namespace. Crear Secrets privados verificados, sin reemplazar los de una base restaurada. Elegir certificados existentes/autorizados del dominio. Para registry privado, añadir imagePullSecrets revisados; el perfil no inventa credenciales del registro.
2. Aplicar ConfigMap runtime, NetworkPolicies y StatefulSets de bases **del perfil revisado**. Aplicar manifiestos renderizados seleccionando tipos/nombres o usar los archivos fuente con `-n climateguard` donde corresponda. No arrancar todavía todos los Deployments si faltan bases/esquemas. Esperar readiness de las cuatro bases y confirmar que son destinos nuevos/autorizados, no bases de producción por una cadena equivocada.
3. Aplicar el ConfigMap renderizado de scripts de Jobs. Ejecutar **solo los Jobs necesarios, individualmente**, no todo `jobs.yaml` a la vez:
   - `provision-auth-db` y `provision-alert-db`: usuarios no superusuario y bases nuevas; no rota usuarios existentes.
   - `provision-mongo`: usuarios Report/Audit solo si faltan; reutiliza los existentes y sus permisos/credenciales.
   - `auth-migrate`: migraciones oficiales compiladas de Auth contra la base ya revisada.
   - `auth-bootstrap-admin`: solo para un entorno nuevo sin el administrador esperado y con Secret privado explícito; usa el seeder oficial, no sobrescribe una cuenta existente.
   - `sql-empty-schema`: **solo base vacía**, no restaurada. Crea `ClimateGuard` si falta y ejecuta DDL protegido; rechaza cualquier base con tablas. El DDL se exportó del modelo EF actual sin conexión. No contiene usuarios, contraseñas ni catálogos/datos de negocio.
4. Para una migración de la aplicación existente, preferir restauración consistente revisada y omitir los Jobs de creación que no correspondan. Proveer el login SQL limitado de aplicación y los catálogos mediante restauración o un procedimiento del responsable, no mediante el viejo `db_init` sin revisar. **No ejecutar `database/ClimateGuard.sql` o scripts de inicialización antiguos automáticamente.** No se preparó una recreación de datos reales ni seeds ficticios.
5. Confirmar esquema completo antes de servicios: Auth roles/users/refresh, SQL sensor/readings/comunidades/reglas/outbox y PostgreSQL Alert. Alert tiene Flyway habilitado y JPA validate: revisar su historial y backups antes del primer arranque contra una restauración; Flyway puede aplicar migraciones pendientes. No confundir SELECT 1 con esquema funcional.
6. Aplicar servicios de aplicación y PVC de PDFs/outbox. Esperar startup/readiness; no publicar Ingress hasta pasar pruebas internas. Un `Recreate` de Gateway/Report implica pausa planificada; es preferible a montar su estado local en réplicas simultáneas.
7. Verificar el Ingress y TLS con host/certificado reales en staging. Mantener el dominio público apuntando al servicio anterior hasta aprobar el corte. Las rutas `/api` y `/` no llevan reescritura adicional. Confirmar HTTP→HTTPS o rechazo de HTTP según controller; no enviar credenciales sobre HTTP.
8. Activar el overlay HPA únicamente después de Metrics Server y prueba de concurrencia. No escalar Gateway, Report ni Auth por un `kubectl scale` manual para eludir sus limitaciones.

Los Jobs no tienen TTL de borrado automático ni retries ilimitados; `backoffLimit=0` hace visible un fallo para revisión. Si se necesita repetir uno, revisar resultado/destino y crear una nueva revisión del Job; no modificar datos ni resetear volúmenes para lograr que «arranque».

## 4. Smoke tests de aceptación

- Verificar rollout, endpoints/endpointslices y eventos de scheduling/probes, sin imprimir Secrets. Confirmar budgets frente a `kubectl top` y disco real.
- TLS: certificado, cadena, hostname, expiración/renovación; Angular carga SPA en rutas profundas y usa `/api`, no localhost. No crear otro certificado para ocultar un fallo de integración.
- Login y refresh reales; usuario administrador y operador de prueba. Usuarios/roles requieren Administrador, Operador recibe 403. No usar JWT sintéticos para el resultado.
- Comunidades reales conservan IDs/sensorCount/coordenadas; no modificar la longitud positiva hasta verificar ubicación.
- Sensores: lista, lectura manual local identificada y recuperación; alerta evaluada una vez, persistencia y resolución. Verificar reintento del outbox SQL y que no haya otro evaluador SQL activo.
- Auditoría: operación real llega a Mongo; detener/reiniciar únicamente la réplica de prueba y comprobar la cola/PVC y ausencia de duplicados.
- Reportes: comunidades, generación de PDF auténtico, historial y descarga. Reprogramar la réplica con su PVC y volver a descargar el mismo PDF. Las probes no prueban fuentes/WeasyPrint ni integridad archivo↔metadatos.
- Comprobar NetworkPolicies: solo frontend/Gateway publicados; conexión no autorizada entre Pods bloqueada; DNS disponible; las políticas dependen del CNI real. No desactivar JWT para «resolver» conectividad.
- Carga de HPA: latencia/errores, réplicas efectivas, consumo/pools DB, idempotencia y escalado hacia abajo. No inferir escalabilidad porque exista el YAML.

## 5. Corte y reversión

Antes del corte: backups restaurables fuera del nodo, copia privada de configuración/Secrets/certificados, estado Git/imagen del despliegue anterior, manifests renderizados y digests anteriores, ventanas de escritura/delta y plan para no perder sesiones/IDs. Mantener el proxy/dominio/HTTPS actuales hasta que el nuevo recorrido pase la aceptación.

Ante fallo de aplicación sin cambio incompatible de datos, aplicar la release anterior revisada o `rollout undo deployment/<servicio>` con contexto y namespace explícitos, observar readiness y probar de nuevo. Los ConfigMaps con hash anteriores deben conservarse: no usar prune automático. Restaurar valores anteriores de configuración/Secrets solo si son compatibles y con el operador responsable.

Rollback de imagen **no revierte migraciones ni datos**. No ejecutar migraciones down, restaurar una copia antigua sobre datos nuevos ni borrar PVCs. Si el fallo afecta a esquema/datos o a una escritura durante el corte, detener la transición y reconciliar respaldos/deltas con los responsables. Gateway y Report conservan su PVC al revertir; no duplicar workers ni perder archivos pendientes.

Si falla la transición del borde, restaurar el enrutamiento previo ya respaldado sin cambiar DNS/certificados innecesariamente. La forma exacta depende del inventario real de Nginx/Caddy/Ingress y debe acordarse antes del corte. No se ejecutó ningún corte ni reversión en esta tarea.

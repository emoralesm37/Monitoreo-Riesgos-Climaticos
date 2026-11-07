# Primer arranque K3s aislado — plan sin ejecutar

> Intento del 06/11/2026: el preflight real detectó falta de margen de RAM y
> bloqueó la creación. Se preparó además un laboratorio sin bases de dos
> Deployments. Ver [resultado](lab-minimal/RESULT-20261106.md) y
> [perfil mínimo y pasos](lab-minimal/README.md). No hubo despliegue real.

Este procedimiento prepara un clúster local NUEVO, sin AWS ni adopción de bases,
volúmenes, secretos, contextos o contenedores existentes. No se ejecutó creación
de clúster, instalación, apply, migraciones ni Jobs en esta revisión.

## Requisitos medidos y bloqueos

- Docker Desktop Linux está disponible, amd64, 16 CPU, 6,62 GiB de RAM asignada.
  Solo figura la distribución WSL `docker-desktop`; no se asume una VM Linux de
  trabajo. `kubectl` cliente 1.36.1 está instalado; k3d y k3s no están en PATH.
- Las aplicaciones y cuatro bases del perfil solicitan 5 024 MiB y tienen límites
  conjuntos de 11 904 MiB, sin contar K3s, Traefik, DNS, sistema y Jobs. Las bases
  locales siguen activas. Esa asignación no deja margen suficiente para ambos
  entornos en paralelo. Propuesta: VM Linux amd64 separada con 16 GiB y disco SSD,
  o presupuesto equivalente en Docker tras revisar capacidad del host. Es una
  estimación operativa para este conjunto de cargas, no el mínimo de K3s.
- PVC solicitados: 20 GiB Auth PG + 20 GiB Alert PG + 20 GiB Mongo + 40 GiB SQL +
  10 GiB PDF + 2 GiB outbox = 112 GiB. Añadir espacio para imágenes, control plane
  y crecimiento; no confundir solicitud de PVC con espacio físico ya reservado.
- Verificar una versión/digest de `rancher/k3s` compatible con las API renderizadas.
  El OpenAPI 1.36.1 usado offline no demuestra compatibilidad con otra versión de
  K3s. Fijar el digest antes de instalar y repetir schema/admission con esa versión.
- Bases/esquemas/catálogos nuevos y Secrets todavía no están provisionados. No se
  puede declarar readiness de dependencias sin hacerlo. No reutilizar credenciales
  ni cadenas que apunten a bases actuales o al host.

## 1. Crear el laboratorio después de resolver capacidad

Instalar k3d desde su release oficial verificada en la máquina elegida. Fijar la
imagen K3s en una variable de la terminal, sin `latest`. Esta revisión no instala
herramientas ni cambia la configuración de memoria de Docker.

Ejemplo PowerShell para una autorización futura, solo en Docker local:

```powershell
# $imagenK3sVerificada debe contener una versión/digest revisado, no un valor inventado.
k3d cluster create cg-isolated --servers 1 --agents 0 --no-lb --api-port 127.0.0.1:6550 --image $imagenK3sVerificada --kubeconfig-update-default=false --kubeconfig-switch-context=false --k3s-arg '--disable=servicelb@server:0' --k3s-arg '--secrets-encryption@server:0'

$kubeconfigAislado = Join-Path $rutaPrivada 'cg-isolated.kubeconfig'
# Ruta nueva y privada; no sustituir ~/.kube/config ni imprimir su contenido.
k3d kubeconfig get cg-isolated | Set-Content -LiteralPath $kubeconfigAislado -Encoding utf8
kubectl --kubeconfig $kubeconfigAislado --context k3d-cg-isolated get nodes
```

Se deja Traefik dentro del clúster, sin listeners publicados en el host; ServiceLB
desactivado. API solo loopback 6550. No conectar la red nueva a las redes Docker
de las bases actuales. Antes del primer arranque comprobar puerto 6550 libre.
La red Docker que k3d crea separa nombres y volúmenes; no impide por sí sola toda
salida al host/Internet. Mantener NetworkPolicies y revisar cualquier egress.

## 2. Importar imágenes y validar el perfil

Las nueve imágenes `climateguard/<servicio>:review-20261106` están construidas.
La lista e identidad local exacta está en `review-evidence-20261106.json`; el tag
no identifica por sí solo el árbol con cambios pendientes. No se publicaron.

```powershell
$servicios = @('frontend','gateway','auth-service','legacy-api','sensor-service','alert-service','report-service','audit-service')
$imagenes = $servicios | ForEach-Object { "climateguard/${_}:review-20261106" }
k3d image import @imagenes --cluster cg-isolated
```

Community independiente está construida pero queda fuera del arranque compatible.
No habilitar el overlay escalable en esta fase. Renderizar `single-node` con el
tag anterior, StorageClass comprobada y el dominio local elegido. Es posible
usar `tools/Dockerfile.validation` para render/validación sin Python en Windows:

```powershell
docker build -t climateguard/manifest-validation:review-20261106 -f infrastructure/k8s/tools/Dockerfile.validation infrastructure/k8s/tools
# Montar solo infrastructure/k8s en /work/k8s:ro y una carpeta de salida en /evidence.
# No montar ~/.kube, .env, credenciales, datos ni el socket Docker.
# Dentro del contenedor sin red:
# python tools/render.py --profile single-node --domain climateguard.test --tag review-20261106 --output /evidence/single-node.yaml
```

El dominio `.test` es un parámetro local/offline, no un dominio registrado de
OAuth. Después de importar, comprobar image IDs en containerd del clúster nuevo.
Ejecutar `kubectl --kubeconfig ... --context k3d-cg-isolated ... --dry-run=server`
solo contra ese laboratorio, después de crear su namespace, para validar admission.
La validación offline ya completada no contacta ningún clúster.

## 3. Secretos y almacenamiento nuevos

Crear exclusivamente los Secrets del contrato `secrets/required-keys.json` usando
archivos privados y `--from-file`; nunca `--from-literal` en una línea con valores.
No imprimir valores o recursos Secret resueltos. Access/refresh/HMAC son claves
distintas del laboratorio y no se copian de los `.env` actuales. SQL debe apuntar
a `sqlserver,1433` dentro del namespace; PostgreSQL a `auth-db`/`alert-db`, Mongo
a `mongodb`. No usar SA como login de aplicaciones.

No aplicar todos los recursos juntos al inicio. Orden para el entorno nuevo:

1. Namespace, ConfigMaps, políticas de red y Secrets privados revisados.
2. PVC y cuatro StatefulSets de bases, con almacenamiento NUEVO `local-path`.
3. Esperar readiness de bases y comprobar UID/fsGroup; ninguna ruta hostPath.
4. Jobs de provisión de usuarios/bases nuevos, uno por uno, `backoffLimit=0`.
5. `auth-migrate`, incluyendo tablas de cuentas externas y flujos OAuth; bootstrap
   administrativo solo si el laboratorio todavía no tiene la cuenta prevista.
6. SQL DDL solo sobre base vacía. Falta acordar una carga autorizada de catálogos
   mínimos: el exportador no inventa sensores, comunidades, mediciones o reglas.
   Revisar el login limitado de aplicación. No ejecutar scripts antiguos de reset.
7. Alert inicia Flyway contra su PostgreSQL nuevo. Hacer visible cualquier fallo
   de migración antes de arrancar productores.
8. Iniciar aplicaciones, primero Auth/Audit/legacy, después Alert/Sensor/Report,
   Gateway y frontend. Readiness de reportes/sensores/legacy exige sus bases;
   liveness no debe usarse como prueba del esquema o permisos de aplicación.

No ejecutar estos pasos contra bases existentes. Están fuera de la autorización
de esta revisión, que solo preparó y verificó artefactos locales.

## 4. Entrada local, OAuth y aceptación

Mantener TLS en Ingress y HTTP solo entre Services. No publicar SQL/Postgres/Mongo.
Para una primera comprobación local, usar un certificado de laboratorio confiable
para el operador y un hostname local resuelto a loopback. El renderer actualmente
genera origen HTTPS sin puerto explícito: usar 443 libre en loopback para el
port-forward autorizado hacia Traefik, o ampliar el renderer antes de elegir otro
puerto público. No apropiarse de un listener existente ni desactivar validación TLS.

Primero probar login local SIN el componente OAuth. Para habilitar Google/GitHub:

- Registrar el dominio/callbacks exactos permitidos por los proveedores y disponer
  de clientes privados específicos del laboratorio; `.test` no se presupone aceptado.
- Renderizar `--oauth` con ese hostname y el Secret `oauth-clients` de cinco claves.
- Su `session-key` debe tener 64 caracteres hexadecimales; claves JWT y HMAC no se
  reutilizan para ese propósito. No imprimir claves ni tickets.
- Verificar salida DNS/HTTPS de Auth y callbacks por Gateway, state/cookie,
  PKCE/nonce, Viewer y refresh, con login humano. No usar cuentas reales automatizadas.

Criterios de aceptación antes de ampliar el laboratorio:

- Probes de cada aplicación y base en verde, puertos/UID/mounts correctos.
- Login local/JWT/401/403; el alias de ingestión física sigue desactivado.
- Reportes de comunidades/sensores/lecturas y PDF/historial persistentes tras
  reiniciar únicamente Report Service, sin perder registros ni artefactos.
- Evaluación de alertas con fixtures aprobados del laboratorio y deduplicación.
- Auditoría HMAC y outbox sin secretos; reserva antes de operaciones críticas.
- NetworkPolicy permite solo los saltos declarados y bloquea conexiones al host.
- No activar HPA de Gateway, Auth o Report mientras conserven sus límites actuales.

Detener el laboratorio si falla la provisión; no corregirlo reutilizando bases o
volúmenes de desarrollo. No hay `delete`, borrado de PVC ni limpieza automática
de datos en este plan. Reversión de esta fase: parar solo `cg-isolated`, conservar
sus volúmenes/evidencia y dejar los servicios actuales intactos.

## Referencias oficiales consultadas

- [K3s: requisitos](https://docs.k3s.io/installation/requirements)
- [K3s: cifrado de Secrets](https://docs.k3s.io/security/secrets-encryption)
- [k3d: crear un clúster](https://k3d.io/stable/usage/commands/k3d_cluster_create/)
- [k3d: importar imágenes](https://k3d.io/stable/usage/commands/k3d_image_import/)

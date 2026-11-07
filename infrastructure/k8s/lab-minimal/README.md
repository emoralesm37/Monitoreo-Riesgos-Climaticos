# Laboratorio mínimo K3s — prueba parcial, clúster detenido

**Reintento posterior del 06/11/2026:** K3s arrancó realmente y el nodo y CoreDNS
quedaron Ready. La RAM Windows cayó a 648 MiB tras importar imágenes; se detuvo
solo el clúster nuevo, conservándolo. Aplicaciones y Job DNS/HTTP no ejecutados.
Ver [resultado del reintento](RESULT-RESUME-20261106.md). El apartado siguiente
describe el intento inicial, anterior a ese arranque.

**La ejecución del 06/11/2026 se detuvo en preflight por falta de margen de RAM.**
No hay clúster, Pods, Secrets ni HTTP de Kubernetes verificados. Ver
[resultado real](RESULT-20261106.md), `preflight-result.json` y
`baseline-consumption.json`. La validación YAML no equivale a un despliegue.

Este perfil reduce el laboratorio a frontend, Gateway y un Job de diagnóstico.
No despliega bases, Auth, Alert, Report o Audit, ni prueba sus recorridos de negocio.
El Job usa la imagen local de Auth solo como runtime Node/JWT. `/probe` comprueba
el salto Gateway→Service frontend; `/restricted` prueba JWT/roles sobre health,
no simula una API de reportes ni un login de usuario.

## Recursos y aislamiento preparados

- Namespace nuevo `climateguard-lab`, distinto del perfil completo.
- Dos Deployments, dos Services ClusterIP, cuatro ConfigMaps, cuatro políticas
  de red y un Job; con Namespace suman 14 recursos sin valores Secret.
- Dos Secrets NUEVOS de prueba: `jwt/access-key`, `audit-signing/key`. No hay
  credenciales de bases ni clientes OAuth. Auditoría de negocio deshabilitada.
- Requests totales con Job: 224 MiB; límites: 480 MiB. Añadir K3s/sistema.
- Un nodo K3s limitado a 3 GiB; sin agentes, LB, Ingress, Metrics Server o PVC.
  CoreDNS y el motor de NetworkPolicy permanecen activos.
- Solo emptyDir nuevos para /tmp/outbox; sin hostPath, PVC o mounts del host.
  Los contenedores no montan tokens automáticos de ServiceAccount.
- `imagePullPolicy: Never`: únicamente imágenes locales importadas expresamente.

Los márgenes del preflight son una elección operativa conservadora: host con
2 GiB disponibles, Linux de Docker con 4 GiB disponibles, dos CPU y 15 GiB de
disco libre. No son mínimos oficiales de K3s. Su finalidad es conservar el host
y servicios actuales mientras un nodo limitado a 3 GiB arranca.

## Secuencia futura, solo tras pasar preflight

No ejecutar contra un contexto existente ni saltarse la salida no cero del gate.
No se instalaron herramientas o descargaron imágenes K3s en este intento bloqueado.

```powershell
node infrastructure/k8s/tools/preflight-isolated.cjs
if ($LASTEXITCODE -ne 0) { throw 'Recursos insuficientes; no crear clúster.' }
```

Instalar k3d portátil desde su release oficial y verificar checksum. Elegir y
fijar una versión/digest oficial de K3s compatible con el cliente, sin `latest`.
Comprobar libre 6550 y ausencia de un clúster llamado `cg-isolated-mini`.
La variable siguiente debe ser la imagen verificada, no una cadena inventada:

```powershell
k3d cluster create cg-isolated-mini --servers 1 --agents 0 --servers-memory 3g --no-lb --api-port 127.0.0.1:6550 --image $imagenK3sVerificada --kubeconfig-update-default=false --kubeconfig-switch-context=false --k3s-arg '--disable=traefik,servicelb,metrics-server,local-storage@server:0' --k3s-arg '--secrets-encryption@server:0'

# Carpeta privada nueva; no sustituir el kubeconfig del operador ni imprimirlo.
$kubeconfigLab = Join-Path $rutaPrivadaNueva 'cg-isolated-mini.kubeconfig'
k3d kubeconfig get cg-isolated-mini | Set-Content -LiteralPath $kubeconfigLab -Encoding utf8
$ctxLab = 'k3d-cg-isolated-mini'
kubectl --kubeconfig $kubeconfigLab --context $ctxLab wait --for=condition=Ready nodes --all --timeout=180s
k3d image import climateguard/frontend:review-20261106 climateguard/gateway:review-20261106 climateguard/auth-service:review-20261106 --cluster cg-isolated-mini
```

Renderizar archivos separados con la imagen auxiliar ya disponible. Montar solo
la infraestructura pública y una carpeta de salida nueva, no kubeconfig/dotenv:

```powershell
docker run --rm --network none --memory 256m --mount "type=bind,source=$rutaK8sPublica,target=/work/k8s,readonly" --mount "type=bind,source=$salidaNueva,target=/evidence" climateguard/manifest-validation:review-20261106 python lab-minimal/render.py --output /evidence
```

Aplicar progresivamente con el contexto privado explícito:

```powershell
kubectl --kubeconfig $kubeconfigLab --context $ctxLab apply -f "$salidaNueva/platform.yaml"
# El script valida API loopback:6550 y marcador del namespace.
# Genera claves nuevas en memoria y usa CREATE: nunca sustituye secretos existentes.
node infrastructure/k8s/lab-minimal/create-test-secrets.cjs $kubeconfigLab $ctxLab
if ($LASTEXITCODE -ne 0) { throw 'No continuar si falló la creación privada.' }
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab apply -f "$salidaNueva/apps.yaml"
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab rollout status deployment/frontend --timeout=120s
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab rollout status deployment/gateway --timeout=120s
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab get pods,deployments,services,endpointslices
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab apply -f "$salidaNueva/probe.yaml"
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab wait --for=condition=complete job/http-dns-probe --timeout=180s
kubectl --kubeconfig $kubeconfigLab --context $ctxLab -n climateguard-lab logs job/http-dns-probe
```

El Job debe resolver dos nombres DNS y obtener nueve respuestas HTTP reales:
frontend health/index/SPA, Gateway health/readiness, proxy a frontend y políticas
anónimo 401, Viewer 403, Administrador 200. Solo imprime resultados, nunca tokens.
Un fallo debe investigarse con eventos y `describe` del recurso afectado, sin
volcar Secrets o variables de proceso.

Medir consumo con `docker stats` del nodo y condiciones/allocatable de Kubernetes;
no hay Metrics Server en este perfil. Si cae el margen de memoria, detener solo
`cg-isolated-mini` con `k3d cluster stop`, conservando sus datos/evidencia. No
eliminar PVC, contenedores o volúmenes ajenos ni cerrar aplicaciones del usuario.

## Alternativa viable actual

Una VM Linux amd64 separada, 4 vCPU, 6 GiB de RAM y 20 GiB libres para ESTE
laboratorio sin bases. Es presupuesto propuesto, no capacidad ya provisionada.
Para todo ClimateGuard, mantener el plan completo de `../ISOLATED-K3S.md` con
presupuesto mayor, Secrets/catálogos nuevos y almacenamiento de 112 GiB más margen.

Fuentes: [requisitos K3s](https://docs.k3s.io/installation/requirements),
[opciones k3d](https://k3d.io/stable/usage/commands/k3d_cluster_create/).

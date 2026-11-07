> **Estado vigente:** [cierre funcional y matriz actualizada](CLOSURE-20261106.md). Ocho tipos PDF y Community/PostgreSQL desplegados; ingesti?n simulada y regresiones aprobadas. Retorno GitHub pendiente de Chrome. El estado anterior de cinco reportes/Community pendientes es hist?rico.

> **Aceptaci?n integral vigente:** [resultados y ocho bloques de evidencia](INTEGRAL-ACCEPTANCE-20261106.md). Chrome 44/44; regresi?n HTTP 58/58; tests dashboard/mapa 16/16; outbox y aislamiento comprobados. Frontend final demo24-mapfix2-20261106. GitHub retorno real sigue pendiente.

> **Estado vigente, 6 de noviembre de 2026:** cutover autorizado ejecutado; K3s y aplicaciones desplegados, HTTPS operativo. Ver [resultados reales](NATIVE-RESULT-20261106.md). Los diagn?sticos previos de este documento son hist?ricos. No hay apagado autom?tico; no crear Scheduler.

# Presentación del 7 de noviembre: 24 horas en la EC2 existente

> Actualización 06/11, 13:05 Guatemala: SSH real comprobado en `EC2_PUBLIC_IP`;
> 6134 MiB disponibles y 47 GiB libres. El usuario confirmó FREE/ACTIVE,
> cr?ditos verificados privadamente y snapshots existentes; no crear nuevos recursos ni respaldos AWS.
> Ver [secuencia exacta pendiente de aprobación](CUTOVER-20261106.md).
> No se detuvo nada ni se instaló K3s. Los apartados anteriores de cuenta
> detenida/US$60 y Scheduler describen el estado inicial y quedan sustituidos
> por esa secuencia. DNS público actualmente devuelve SERVFAIL.

**Última instrucción vigente:** reutilizar `ClimateGuard-Server`, instancia `i-REPLACE_INSTANCE_ID`, `m7i-flex.large`, Ohio `us-east-2`. No cambiar plan/tipo, no crear instancias, no eliminar datos y **no instalar K3s todavía**. El plan de reemplazo por 16 GiB del directorio superior queda como alternativa histórica, no como acción autorizada.

Estado actual: EC2 encendida por el usuario, SSH comprobado en `EC2_PUBLIC_IP`. No se leyó el contenido de la llave ni se conectó a la IP antigua. El usuario confirmó FREE/ACTIVE, cr?ditos verificados privadamente y un snapshot completado más otro en curso. La sesión no ejecutó operaciones AWS de encendido, EBS/snapshot/schedule ni aplicó manifiestos. Se preservarán los respaldos existentes sin crear otros.

## 1. Primero CloudShell Ohio: solo lectura

Abrir CloudShell autenticado, región Ohio. Estos comandos se pueden copiar directamente; no crean recursos ni acceden a credenciales:

```bash
export AWS_REGION=us-east-2
export AWS_PAGER=''
CG_INSTANCE=i-REPLACE_INSTANCE_ID

aws freetier get-account-plan-state --region us-east-1 \
  --query '{Plan:accountPlanType,Status:accountPlanStatus,Credits:accountPlanRemainingCredits,Expires:accountPlanExpirationDate}'

aws ec2 describe-instances --region us-east-2 --instance-ids "$CG_INSTANCE" \
  --query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Architecture:Architecture,AZ:Placement.AvailabilityZone,PublicIp:PublicIpAddress,Root:RootDeviceName,Disks:BlockDeviceMappings,CPU:CpuOptions}'

aws ec2 describe-volumes --region us-east-2 \
  --filters "Name=attachment.instance-id,Values=$CG_INSTANCE" \
  --query 'Volumes[].{Id:VolumeId,GiB:Size,Type:VolumeType,State:State,AZ:AvailabilityZone,Encrypted:Encrypted,Attachments:Attachments}'

aws service-quotas get-service-quota --region us-east-2 \
  --service-code ec2 --quota-code L-1216C47A --query 'Quota.{Name:QuotaName,Value:Value}'

CG_VOLUMES=$(aws ec2 describe-volumes --region us-east-2 \
  --filters "Name=attachment.instance-id,Values=$CG_INSTANCE" \
  --query 'Volumes[].VolumeId' --output text | tr '\t' ',')
test -n "$CG_VOLUMES" && aws ec2 describe-snapshots --region us-east-2 --owner-ids self \
  --filters "Name=volume-id,Values=$CG_VOLUMES" \
  --query 'Snapshots[].{Id:SnapshotId,Volume:VolumeId,State:State,Progress:Progress,Started:StartTime,GiB:VolumeSize,Encrypted:Encrypted}'

aws ec2 describe-instance-attribute --region us-east-2 --instance-id "$CG_INSTANCE" \
  --attribute instanceInitiatedShutdownBehavior
aws ec2 describe-instance-attribute --region us-east-2 --instance-id "$CG_INSTANCE" \
  --attribute disableApiStop
```

No sustituir un AccessDenied por «saldo suficiente» o «sin snapshots». Si falta la API Free Tier en la versión de CLI o permisos Billing, revisar **Billing → Credits/Free Tier** manualmente; no cambiar el plan. La expiración debe cubrir la presentación. Un snapshot `completed` es recuperable como volumen, pero no demuestra que se haya probado su restauración ni consistencia de aplicación.

Para diagnóstico completo con precio real de Ohio, cargar el archivo local `account-check.py` con Actions → Upload file de CloudShell y ejecutar:

```bash
mkdir -p "$HOME/cg-demo-private"
chmod 700 "$HOME/cg-demo-private"
python3 account-check.py --instance-id i-REPLACE_INSTANCE_ID \
  --output "$HOME/cg-demo-private/account-check.json"
```

El script hace solo consultas: plan/créditos, cuota estándar vCPU, tipo/oferta, EBS, EIP, snapshots, SSM y AWS Pricing `GetProducts` para Linux Shared `m7i-flex.large` en Ohio, gp2/gp3, snapshots e IPv4. Conserva SKU, unidad y fecha efectiva. La oferta regional no prueba capacidad física ni permisos de arranque. No ejecuta upgrade, start, stop, resize, create o delete. No muestra access keys/tokens ni lee user-data o Secrets Manager. Mantener su reporte fuera de Git.

## 2. Diagnóstico SSH: únicamente después de un encendido aprobado

La instancia ya está encendida y SSH fue verificado. No usar `PREVIOUS_EC2_PUBLIC_IP`: es la dirección anterior. Si vuelve a reiniciarse, obtener de nuevo su IP con `describe-instances`; no se incluye aquí una ejecución de start.

En PowerShell de Windows, una vez verificada la nueva IP y la clave pública del host por un canal confiable:

```powershell
$cgIp = 'EC2_PUBLIC_IP' # Reconfirmar si se reinicia EC2.
$cgKey = Join-Path $env:USERPROFILE '.ssh/ClimateGuard-Key.pem'
$cgTmp = ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -i $cgKey "ubuntu@$cgIp" 'mktemp -d /tmp/cg-demo24-preflight.XXXXXXXX'
if ($LASTEXITCODE -ne 0 -or $cgTmp -notmatch '^/tmp/cg-demo24-preflight\.[A-Za-z0-9]+$') { throw 'Ruta remota no válida' }
scp -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -i $cgKey infrastructure/k8s/aws/demo24/ssh-readonly.sh "ubuntu@${cgIp}:$cgTmp/ssh-readonly.sh"
if ($LASTEXITCODE -ne 0) { throw 'Falló SCP' }
ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -i $cgKey "ubuntu@$cgIp" "bash $cgTmp/ssh-readonly.sh"
```

Si falta una clave de host conocida, verificar primero su fingerprint por consola/SSM y hacer el primer acceso manual. No desactivar host key checking ni leer/imprimir la llave privada. El script consulta RAM, CPU, discos, mounts, listeners, herramientas y estados/inventario Docker; **no inicia bases, no detiene servicios ni imprime variables/configuraciones o logs**. Si el despliegue viejo arranca automáticamente al encender EC2, registrarlo; no pararlo todavía sin aprobación con nombres exactos.

Los `.sh` del repositorio ya eran LF; la tubería `Get-Content -Raw | ssh ... bash -s` puede introducir CRLF desde Windows PowerShell. SCP conserva los bytes: se comprobó en el servidor que el SHA256 coincide y el diagnóstico terminó con exit 0, sin error `\r`. `.gitattributes` y `check-linux-files.cjs` previenen CR/BOM en scripts futuros.

## 3. Perfil propuesto de 2 CPU/8 GiB, todavía sin prueba de runtime

Se reutilizan las nueve imágenes `release-20261106-f0048fcb2ff2`, verificadas sin cambios en sus 423 archivos de entrada. Ocho Deployments activos mantienen la compatibilidad actual; la novena imagen Community independiente se conserva inactiva. No se construye código en la EC2.

`candidate/` es un render separado para la demo; no modifica los PVC base ni recursos existentes. Requests agregados: **990m CPU / 3808 MiB**. Límites de memoria de aplicaciones y bases: **5728 MiB**. Reservas propuestas SO/K3s: 400m CPU / 1152 MiB; también se necesita margen para los Pods del sistema (CoreDNS, Traefik, Metrics Server y cert-manager). Los límites CPU están sobreasignados y pueden provocar throttling bajo concurrencia. Son presupuestos de baja carga, **no mediciones completas**.

SQL conserva request mínimo 2 GiB y límite 2304 MiB; Mongo limita explícitamente WiredTiger a 0.25 GB. JVM y servicios tienen límites menores que el perfil de 16 GiB. El funcionamiento completo puede fallar por OOM/CPU y debe probarse progresivamente; no afirmar viabilidad garantizada por sumar requests. M7i-flex tiene rendimiento CPU base y ráfagas; no aplicar políticas de créditos T3 a esta familia. No se habilita HPA.

Solo Angular usa **dos réplicas**, porque sirve archivos estáticos. Gateway, Auth, Report y todas las bases siguen con una. Esto demuestra replicación segura de frontend, no HA del servidor.

| Persistencia nueva | Tamaño propuesto |
|---|---:|
| PostgreSQL Auth | 2 GiB |
| PostgreSQL Alert | 2 GiB |
| MongoDB | 4 GiB |
| SQL Server | 8 GiB |
| PDF | 2 GiB |
| Outbox Auditoría | 1 GiB |
| Total | **19 GiB** |

Estos tamaños son para un dataset universitario pequeño; no para históricos de producción. Preferir una carpeta nueva del filesystem actual **solo si SSH confirma al menos 40 GiB libres**, snapshot recuperable y ausencia de conflictos. Si no hay margen, proponer **un único EBS nuevo de 40 GiB**, tras aprobación; no agregarlo por defecto. Los 19 GiB de PVC más imágenes, K3s y margen motivan ese presupuesto. `local-path` no reserva físicamente ni impone la cuota declarada: medir disco real y detener antes de llenar root. Nunca reapuntar un PVC viejo a la nueva ruta.

El config de demo ubica todo lo nuevo en `/srv/climateguard-demo/{k3s,pv}`; puede vivir en un EBS dedicado o en el filesystem comprobado. Formatear un dispositivo o cambiar fstab exige aprobación de dispositivo/volumen exactos. No se generó ningún `mkfs` automático.

## 4. Costo de 24 horas y aprobación necesaria

**Precio real, créditos, snapshots y restricciones siguen SIN verificar hasta ejecutar CloudShell.** Una referencia oficial de M7i-flex.large es US$0.09576/h; no se presenta como precio vigente de Ohio. A esa referencia, 24 horas de CPU serían US$2.30. Referencias adicionales: IPv4 US$0.12/día; 40 GB gp3 a US$0.08/GB-mes ≈ US$0.11/día; root64 gp3 ≈ US$0.17/día; primer snapshot64 a US$0.05/GB-mes, como cota de datos almacenados, ≈ US$0.11/día. Prorrateo de 30 días y tamaños nominales solo para presupuestar.

Propuesta orientativa: **US$3–6 por la ventana**, incluyendo margen operativo; techo de aprobación propuesto **US$8, siempre menor al objetivo de US$10**. No es una tarifa garantizada ni un límite automático de Billing. Ajustar con SKU/precio reales, volumen raíz real, snapshots existentes, horas de preparación, egreso y recursos de otras regiones. Los créditos se consumen aunque no haya cargo bancario. No contratar EKS, NAT Gateway, ALB, instancias nuevas o Savings Plans.

Antes de empezar, presentar y aprobar en un solo bloque concreto: encendido de esta EC2, ventana UTC/Guatemala, snapshots por ID de volumen y retención, eventual EBS40 solamente si hace falta, costo calculado, parada reversible de servicios viejos identificados, ruta de datos nuevos, Secrets y configuración de apagado. **No solicitar aprobación genérica de borrado.** No cambiar tipo ni plan bajo este objetivo.

Fuentes: [plan y créditos](https://docs.aws.amazon.com/cli/latest/reference/freetier/get-account-plan-state.html), [referencia de precio](https://builder.aws.com/content/3BlPcDGddaB6WkPvUf1LIy1rzIm/everything-you-need-to-know-to-get-started-with-aws-free-tier), [características Flex](https://docs.aws.amazon.com/ec2/latest/instancetypes/), [EBS](https://aws.amazon.com/ebs/pricing/), [IPv4](https://aws.amazon.com/vpc/pricing/).

## 5. Orden posterior autorizado, no ejecutado

1. Conservar los snapshots existentes y el EBS original; no crear otros respaldos o recursos AWS. Registrar el snapshot completado y los volúmenes originales como punto de recuperación. Seguir la secuencia nueva `CUTOVER-20261106.md` y obtener aprobación antes de detener/reemplazar servicios.
2. Configurar un deadline absoluto de 24 horas para detener **solo esta EC2**, verificarlo y arrancar la instancia aprobada. Obtener IP nueva; actualizar DNS solo con aprobación. No iniciar K3s en este paso.
3. Diagnóstico SSH. Identificar servicios y política de reinicio viejos. Su eventual parada/deshabilitación es reversible, pero debe estar en el alcance aprobado; conservar estados para rollback. No ejecutar prune/clean ni down -v.
4. Elegir almacenamiento tras medir; si requiere EBS40, aprobar volumen/AZ/cifrado/costo y dispositivo antes de crear/formatear. Mantener datos viejos intactos.
5. En una autorización posterior de instalación, copiar `candidate/k3s-config.yaml`, instalar K3s nativo fijado y verificado; revisar nodo y Pods del sistema antes de las bases. Los archivos del padre `aws/candidate` son del perfil mayor: **usar los de demo24/candidate**.
6. Transferir imágenes desde Windows directamente por SSH/SCP y comprobar SHA256. No intentar almacenar el tar de varias GB en el home pequeño de CloudShell. No push Git ni registro. Importar en el containerd correcto según el `data-dir` de demo.
7. Aplicar plataforma, crear Secrets nuevos privadamente, bases una a una, siete Jobs secuenciales y dataset de catálogos/reglas aprobado. Los bloqueos de catálogos, OAuth HTTPS y edición SQL del plan anterior siguen vigentes. No inventar datos físicos para la presentación.
8. Aplicar los ocho Deployments gradualmente. Medir consumo nativo tras cada servicio; parar si hay OOM, evictions, presión de disco/memoria o latencia que impida operar. No aumentar límites por encima de la RAM ni cambiar instancia para ocultar el fallo.
9. Ejecutar Job interno DNS/readiness, luego cert-manager, Ingress, HTTPS y redirección. Validar TLS real y renovación sin `-k`. Mantener `climateguard.garher.lat` y callbacks `/api/auth/callback/google` y `/api/auth/callback/github`; usuario interviene en los logins reales.
10. Ejecutar la aceptación descrita abajo, reinicios de Pods con persistencia y comprobación del deadline. Conservar evidencia sanitizada.

Si el perfil no resulta estable en 8 GiB, detener la secuencia y presentar la medición; no cambiar tipo ni retirar funciones silenciosamente. Una alternativa es mantener los servicios Docker existentes y demostrar preparación K3s, pero eso **no cumple un despliegue K3s completo** y requiere aceptar explícitamente esa limitación.

## 6. Diseño histórico de Scheduler — NO autorizado en el alcance actual

**No ejecutar los comandos IAM/Scheduler de este apartado.** La instrucción vigente prohíbe recursos AWS adicionales. Seguir `CUTOVER-20261106.md`: timer systemd local en la EC2 existente, solo tras verificar shutdown behavior `stop`. El texto siguiente conserva el diseño previo, no una autorización de creación.

`shutdown-plan.py` genera planes, **no los instala**. Requiere reporte real con EBS root, shutdown behavior `stop` y stop protection desactivada; rechaza estados desconocidos/terminate. Genera una política IAM limitada a `ec2:StopInstances` sobre esta instancia, un EventBridge Scheduler one-shot y un timer systemd absoluto persistente de respaldo. No genera permisos de terminación/borrado ni reinicio automático. Rechaza sobrescribir un plan para no extender accidentalmente la ventana.

Tras los diagnósticos y aprobación, cargar también ese script en CloudShell:

```bash
python3 shutdown-plan.py --account-report "$HOME/cg-demo-private/account-check.json" \
  --output "$HOME/cg-demo-private/shutdown-private-01"
```

Leer `summary.json`: deadline UTC y Guatemala, instancia y rol. Los siguientes comandos **crean recursos/configuración y requieren la aprobación previa descrita**, no fueron ejecutados:

```bash
CG_PLAN="$HOME/cg-demo-private/shutdown-private-01"
CG_ROLE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["role"])' "$CG_PLAN/summary.json")
aws iam create-role --role-name "$CG_ROLE" \
  --assume-role-policy-document "file://$CG_PLAN/trust.json" || { echo 'No se creó un rol nuevo; detenerse sin reemplazar el existente.'; exit 1; }
aws iam put-role-policy --role-name "$CG_ROLE" --policy-name stop-one-demo-instance \
  --policy-document "file://$CG_PLAN/stop-policy.json" || exit 1
# Esperar propagación IAM y revisar cualquier error; no crear targets alternativos.
aws scheduler create-schedule --region us-east-2 --cli-input-json "file://$CG_PLAN/schedule.json" || exit 1
CG_SCHEDULE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["schedule"])' "$CG_PLAN/summary.json")
aws scheduler get-schedule --region us-east-2 --name "$CG_SCHEDULE" \
  --query '{State:State,When:ScheduleExpression,Timezone:ScheduleExpressionTimezone,Window:FlexibleTimeWindow,Target:Target}'
```

Comprobar ENABLED, UTC, OFF, ARN `ec2:stopInstances`, InstanceIds exacto y rol/política. Un Scheduler no garantiza acceso si IAM/plan lo bloquea; no empezar la demo sin verificar al menos un mecanismo disponible. Precio público Scheduler: 14 millones de invocaciones/mes gratuitos; verificar elegibilidad del servicio en la cuenta. No desplegar la solución grande Instance Scheduler con recursos adicionales.

En EC2, **después de copiar el plan y aprobar la instalación del timer**, confirmar de nuevo por CloudShell que `instanceInitiatedShutdownBehavior=stop`. Crear un marcador root-only `/etc/climateguard-demo-stop/stop-behavior-verified`, instalar las dos unidades generadas en `/etc/systemd/system`, ejecutar `systemd-analyze verify` sobre ellas, `systemctl daemon-reload`, y `systemctl enable --now climateguard-demo-stop.timer`. Leer `systemctl list-timers --all climateguard-demo-stop.timer` y `systemctl show ... -p NextElapseUSecRealtime` para comprobar el deadline exacto. No usar poweroff con comportamiento terminate.

Prueba no destructiva del despachador, solo en EC2 y tras autorizar estas escrituras nuevas:

```bash
sudo install -d -m 700 /var/lib/climateguard-demo-stop
sudo systemd-run --unit=cg-demo-timer-proof --on-active=10s \
  /usr/bin/touch /var/lib/climateguard-demo-stop/dispatch-proof
# Después de 10 s: comprobar existencia del marcador y journalctl -u cg-demo-timer-proof.
```

Esto prueba despacho de un timer inocuo, **no que EC2 ya se detuvo**. Después del deadline comprobar `describe-instances` estado stopped y el evento `StopInstances` en CloudTrail para Scheduler; el respaldo OS puede detener sin ese evento API. No afirmar apagado real antes de observarlo. El Scheduler y el timer no se han configurado en esta preparación.

**Apagar EC2 no deja todos los costos en cero.** EBS, snapshots y algunas IPv4/EIP siguen facturando. Después de la presentación: inventariar IDs nuevos, conservar respaldo durante retención acordada, pedir aprobación separada para borrar EBS/snapshots/liberar EIP y quitar el schedule/rol propios. No crear una limpieza automática que borre datos. Mantener las bases/volúmenes viejos hasta aprobar su retirada explícita.

## 7. Estado de ocho recorridos, sin confundirlos con una rúbrica no recibida

| Recorrido de aceptación | Estado AWS actual |
|---|---|
| Angular y réplicas | Pendiente: EC2 detenida |
| Gateway, JWT y 401/403 | Pendiente AWS; pruebas de imagen/local previas disponibles |
| Auth, refresh y OAuth Google/GitHub HTTPS | Pendiente AWS y participación del usuario |
| Comunidades | Pendiente AWS; se conserva backend compatible |
| Sensores/lecturas | Pendiente AWS, catálogos/datos aprobados; sin Arduino |
| Alertas | Pendiente recorrido real lectura→regla→evaluación→persistencia |
| Auditoría | Pendiente entrega, outbox y recuperación tras reinicio |
| Reportes PDF/historial | Pendiente AWS; tres tipos existentes, cinco adicionales de la especificación sin implementar |

No se ha recibido una rúbrica exacta de ocho requisitos. Esta tabla organiza pruebas, no declara cumplimiento académico. Usar `../internal-probe.cjs` para DNS/readiness y `../e2e.cjs` para parte de la aceptación HTTPS con cuentas nuevas aprobadas. Reiniciar Pods controladamente y verificar que sobreviven datos/PDF/outbox; probar aislamiento desde un Pod sin etiquetas permitidas. La existencia de YAML o una prueba local no constituye evidencia AWS.

## Evidencia de esta preparación

- Imágenes release: nueve disponibles; huella de 423 archivos sin cambios.
- Perfil: validación semántica y OpenAPI core 1.36.1 offline PASS; CRDs/admission, todavía sin validar en servidor.
- Once pruebas de capacidad y seguridad del apagado PASS: prohíben terminar, ampliar el deadline sobre el mismo plan o asumir precio cero ante AccessDenied.
- Dieciséis comprobaciones HTTP Docker con límites CPU/RAM del perfil PASS y PDF técnico real PASS, sin red a bases, puertos host ni datos existentes. Las respuestas de readiness sin base son 503 esperado, no readiness aprobada.
- Muestras Docker: Angular 12.51/48 MiB; Gateway 28.3/192; backend compatible 49.52/256; Sensor 47.73/256; Report 88.35/512. No sumarlas como consumo completo: se ejecutaron secuencialmente y faltan bases/control plane/Auth/Alert/Audit.
- No se midió consumo EC2 ni se comprobó saldo, precio Ohio, plan, snapshots, SSH, E2E AWS o detención real. No hay schedule/timer instalado.
- Evidencia sanitizada: `observations.json` e `image-smoke-capped.json`. Los scripts de diagnóstico no fueron ejecutados contra AWS.

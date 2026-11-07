# Ejecución y alcance de aprobación

Preparado el 06/11/2026. **Ninguno de los pasos AWS siguientes fue ejecutado.** No ejecutar comandos con destinos o identificadores supuestos. No instalar sobre la EC2 vieja sin inventario y mantenimiento aprobados.

## 1. Inventario de solo lectura y presupuesto

Usar una conexión SSH/SSM ya configurada al servidor identificado. `inventory-readonly.sh` no lee dotenv, credenciales, bases o variables de contenedores. Desde consola/API con acceso existente, obtener únicamente: región, ID/tipo/arquitectura/AMI, volúmenes con ID/tamaño/cifrado/mount, SG, Elastic IP/asociación, rol IAM y propietario del DNS. Verificar también si hay proxy DNS/CDN, AAAA, puertos 80/443, Nginx/systemd y certificados actuales. No volcar user-data, Secrets Manager, tokens IMDS ni variables de entorno.

El IP DNS y los recursos concretos pueden cambiar. El resultado público anterior no sustituye este inventario. Falta acceso configurado en esta sesión: no se intentaron claves o cuentas alternativas.

Aprobar antes de ejecutar: región/tipo/precio, nueva EC2 y almacenamiento con sus costos, presupuesto temporal de convivencia, rol/SG y ruta administrativa. Propuesta: nueva t3a.xlarge amd64 + root32 gp3 + datos160 gp3 cifrados, misma región para facilitar EIP y rollback. No usar la AMI de Marketplace con SQL comercial por accidente.

## 2. Preparar el reemplazo sin afectar al anterior

Crear la EC2 y disco nuevos con etiquetas inequívocas de release; no reutilizar volúmenes de bases. Reservar acceso SSH limitado o SSM; 80/443 públicos al publicar, 6443/10250/8472 sin acceso público; no publicar 1433/5432/27017. Si hay un registro privado o S3 de transferencia, permisos mínimos y sin claves permanentes en manifiestos.

Verificar arquitectura, RAM, disco, montaje persistente y espacio antes de continuar. Para datos, usar UUID y comprobar que `/srv/climateguard-v2` pertenece al NUEVO EBS. Formatear un disco es destructivo: requiere ID de volumen y dispositivo comprobados y aprobación explícita; este paquete no incluye un `mkfs` automático.

Instalar K3s nativo, **no k3d en EC2**. Versión candidata verificada en el laboratorio: `v1.37.2+k3s1`. Descargar binario amd64 y SHA256 de la release oficial; verificar hash y script de servicio antes de instalar. Fijar versión y conservar evidencia. Copiar `k3s-config.yaml` a la ruta de configuración solo en el host nuevo y montar datos antes del inicio. Conservar Traefik, ServiceLB y CoreDNS; validar sus labels/puertos reales. Los listeners 80/443 deben estar libres en el nuevo host.

K3s cifrará Secrets. El kubeconfig root/admin queda 0600 en el servidor; acceso remoto mediante túnel SSH/SSM y fichero privado nuevo, sin publicar 6443. Crear un contexto de administración explícito `cg-aws-v2`. Todo comando posterior debe indicar kubeconfig y contexto, sin cambiar el contexto predeterminado del operador:

```powershell
# Rutas privadas suministradas por el operador, nunca imprimir el fichero.
$kubeconfigV2 = $rutaPrivadaVerificada
$ctxV2 = 'cg-aws-v2'
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 get nodes -o wide
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 get pods -n kube-system
```

Detener la secuencia ante NotReady, MemoryPressure, DiskPressure, errores de montaje o uso sostenido de créditos. No continuar por haber validado YAML.

## 3. Transferir la release sin Git ni registro

Localmente, tras autorización de transferencia, usar la lista exacta de `candidate/release-lock.json` para exportar con `docker save --output` a una carpeta privada. No exportar contenedores/volúmenes, dotenv ni contextos completos. Registrar SHA256 del archivo, transferir por SSH/SSM al host nuevo, comprobar el mismo SHA256 e importar con `sudo k3s ctr images import <archivo>`. Verificar los tags/digests en containerd. `imagePullPolicy: Never` impide sustituirlos por imágenes de otro registro. No convertir ciegamente un ID local en un digest de un registro externo.

Las bases usan los tres digests oficiales fijados en `database-images.json`. Si se requiere operación sin descargas, descargarlas/exportarlas por separado y comprobar también su arquitectura. Las versiones de SO/K3s/Traefik/cert-manager son componentes adicionales al lock de las nueve aplicaciones y deben registrarse en la evidencia de instalación. No llamar reproducible bit a bit a un build con dependencias base no congeladas.

## 4. Plataforma, Secrets y almacenamiento

Revisar `candidate/00-platform.yaml` y validar con el API del nuevo servidor antes de aplicar. `StorageClass/cg-retain` es nueva, sin modificar la StorageClass predeterminada. Los PVC usan volúmenes nuevos y reclaim Retain. Antes de arrancar bases, verificar que todos los PV resultantes residen en el nuevo EBS; nunca asignar un PV viejo por nombre.

```powershell
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 apply --dry-run=server -f infrastructure/k8s/aws/candidate/00-platform.yaml
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 apply -f infrastructure/k8s/aws/candidate/00-platform.yaml
```

Generar y crear Secrets privados NUEVOS conforme a README, sin imprimir valores ni usar `kubectl get secrets -o yaml`. OAuth requiere revisión manual de aplicaciones de Google/GitHub: origen `https://climateguard.garher.lat`, callbacks exactamente `/api/auth/callback/google` y `/api/auth/callback/github`. Mantener flujo local autorizado o crear clientes específicos de hosting; no modificar clientes existentes sin aprobación. No poner tokens en URL o logs.

`sql-app-bootstrap` debe tener username nuevo y contraseña de 32–128 caracteres del alfabeto admitido por su script; usar una contraseña aleatoria fuerte con mayúsculas/minúsculas/dígitos/símbolos permitidos. `sql-app/connection-string` debe apuntar a `sqlserver,1433`, base `ClimateGuard` y esa misma identidad. Los administradores de PG/Mongo/SQL solo se montan donde se necesitan. No reemplazar un Secret ya existente para hacer pasar un Job.

## 5. Bases y Jobs, secuencialmente

```powershell
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 apply -f infrastructure/k8s/aws/candidate/01-databases.yaml
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 -n climateguard rollout status statefulset/auth-db --timeout=300s
# Repetir para alert-db, mongodb y sqlserver; comprobar PVC/PV y eventos.
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 apply -f infrastructure/k8s/aws/candidate/02-job-config.yaml
```

Aplicar individualmente y esperar `Complete` antes del siguiente Job:

1. `job-provision-auth-db.yaml`
2. `job-provision-alert-db.yaml`
3. `job-provision-mongo.yaml`
4. `job-sql-empty-schema.yaml`
5. `job-provision-sql-app.yaml`
6. `job-auth-migrate.yaml`
7. `job-auth-bootstrap-admin.yaml`

```powershell
# Ejemplo; no bucle que ignore fallos ni apply de jobs.yaml completo.
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 apply -f infrastructure/k8s/aws/candidate/job-auth-migrate.yaml
kubectl --kubeconfig $kubeconfigV2 --context $ctxV2 -n climateguard wait --for=condition=complete job/auth-migrate --timeout=600s
```

Guardar estados y revisar errores privadamente; no exportar logs que puedan contener una conexión o consulta con contraseña. Ningún Job debe apuntar a un host externo. Inicializar catálogos y reglas solo con dataset aprobado; este es un bloqueo real pendiente, no un seed inventado. Flyway Alert se ejecuta posteriormente al arrancar su aplicación. No ejecutar DROP, truncados, repair o migraciones reversas para ocultar un fallo.

## 6. Aplicaciones y prueba interna

Aplicar `03-applications.yaml`; esperar rollout individual de los ocho Deployments, revisar réplicas disponibles, reinicios, eventos, PVC/UID y EndpointSlices. Observar `free`, cgroups, CPU, disco y `kubectl top` si Metrics Server está operativo; no usar solo requests como consumo real.

Aplicar `06-internal-probe.yaml`; esperar Complete y leer únicamente su JSON sanitizado. Debe resolver los ocho FQDN y obtener ocho readiness HTTP 200, incluidas consultas de salud a las bases a través de sus servicios. Si algún valor da 503, no publicar. El Job no demuestra todavía operaciones de negocio.

Comprobar aislamiento: ningún Service de base expuesto, egress permitido para OAuth/DNS y NetworkPolicy efectiva. Probar también una conexión denegada desde un Pod sin la etiqueta autorizada; la presencia del YAML no demuestra que CNI la aplique.

## 7. Ingress, TLS y cambio de dominio

Instalar cert-manager desde release oficial fijada y revisada, candidata `v1.21.3`, verificando hash del manifiesto y compatibilidad con K3s antes de aplicar. Esperar CRDs, webhook y controller Ready. No usar una URL `latest` al ejecutar. Validar `04-issuer.yaml` mediante `--dry-run=server` y aplicar. Las reglas ACME permiten tráfico Traefik→solver en 8089; comprobar labels reales del solver y del controlador.

Antes de modificar DNS/EIP, documentar propietario, valores A/AAAA/CNAME, TTL y asociación actuales, y comprobar que rollback restaura exactamente esos recursos. Para smoke previo usar `curl --resolve` sobre el IP nuevo con certificado temporal privado y verificación correcta; no desactivar la verificación TLS de una prueba presentada como aprobada. La emisión HTTP-01 del certificado final requiere que el dominio llegue al solver; probar con staging ACME antes de emisión definitiva cuando se autorice el cambio DNS.

Tras aprobación explícita, aplicar `05-ingress.yaml`, cambiar A/EIP manteniendo `climateguard.garher.lat` y vigilar emisión de `climateguard-tls`, SAN, cadena, caducidad y renovación. Resolver AAAA/CDN si existe; no cambiar nameservers innecesariamente. HTTP debe redirigir a HTTPS salvo challenge ACME. Nunca publicar el Secret TLS en evidencia.

Validar y aplicar además `07-http-redirect.yaml` tras comprobar los CRDs Traefik: su Middleware redirige la entrada HTTP de aplicación. El solver ACME usa su propio Ingress con una ruta más específica y sin ese middleware. Verificar realmente challenge, redirección y renovación; la validación core OpenAPI no valida este CRD.

## 8. Aceptación end-to-end y durabilidad

`node infrastructure/k8s/aws/e2e.cjs` comprueba únicamente rutas públicas/401/callbacks inválidos, sin cuentas. **No se ejecutó en esta preparación.** Las opciones `--accounts --reports` requieren `CG_E2E_APPROVED_NEW_ENV=yes` y credenciales de dos cuentas de prueba nuevas (Admin/Viewer) entregadas privadamente por variables de proceso. No reutilizar cuentas reales. La prueba crea sesiones y, con `--reports`, tres reportes persistentes; no elimina nada. Nunca imprimir variables ni resultado de login.

| Recorrido | Criterio de aceptación |
|---|---|
| Angular/rutas profundas | HTTPS 200, assets sin mezcla HTTP, `/api` siempre Gateway |
| Login y Usuarios | Admin local 200, claims válidos, Viewer 403 en gestión, anónimo 401 |
| Refresh/logout | Token nuevo, anterior 401, proveedor conservado, logout invalida refresh |
| Google/GitHub | Usuario inicia sesión manualmente; callbacks, estado/cookie, intercambio único, Viewer, vinculación explícita y refresh del proveedor |
| Comunidades/Sensores | CRUD autorizado con datos nuevos identificados, asociaciones/sensorCount correctos, filtros y lectura manual |
| Alertas | Lectura→regla→evaluación Java, resultado persistente, entrega/reintento sin duplicar; Arduino fuera de alcance |
| Auditoría | Operaciones anteriores CONFIRMED; caída temporal del destino y recuperación de outbox sin pérdidas |
| Reportes | Tres tipos actuales: datos reales o vacío explicado, filtros, `%PDF-`, historial/usuario/descarga, Viewer 403 |
| Persistencia | Reinicio controlado de Pods conserva cuentas, lecturas, alertas, historial, PDF y outbox |
| Backup/restore | Copia consistente de SQL/PG/Mongo+PDF, restaurada y comprobada en destino separado |
| Capacidad | Sin OOM/restarts, memoria y disco con margen, CPU/créditos/latencia bajo carga acordada |

El runner automatiza solo parte de esta tabla. Los cinco tipos PDF restantes de la especificación, separación de Community y cualquier criterio adicional de la rúbrica deben quedar pendientes explícitos. No marcar «8/8» por haber iniciado ocho Deployments.

## 9. Retirada y rollback — sin autorización de eliminación

**No se ejecutó retirada alguna.** La propuesta más segura mantiene el servidor viejo con sus discos/datos durante una ventana acordada (propuesta: 7 días después de aceptación). No hay comandos de eliminación en este paquete.

La ficha de aprobación debe rellenarse con inventario real:

| Acción propuesta | Alcance que debe identificarse | Aprobación actual |
|---|---|---|
| Crear reemplazo/costos | Región, tipo, AMI, nuevos EBS, SG/IAM/EIP y presupuesto | Pendiente |
| Cortar tráfico | Registro DNS/TTL o asociación EIP exacta y ventana | Pendiente |
| Detener despliegue viejo | ID EC2 o nombres exactos de servicios/contenedores y puertos | Pendiente |
| Eliminar datos de prueba viejos | ID de cada volumen, mount, base/backup y fecha de retención | **No autorizado** |
| Terminar EC2/eliminar EBS/snapshots | IDs exactos, DeleteOnTermination y dependencias | **No autorizado** |

Sin IDs no existe alcance de borrado verificable; no solicitar ni aceptar una aprobación genérica que los sustituya. Conservar snapshots coherentes de las bases, manifiestos de la release anterior y DNS/EIP previo. La EIP puede moverse entre instancias solo con inventario y aprobación; la IP pública efímera puede cambiar tras stop/start.

Rollback antes de admitir escrituras: restaurar asociación DNS/EIP y reactivar únicamente el despliegue anterior aprobado. Tras aceptar escrituras en bases nuevas, congelarlas y decidir reconciliación/exportación: volver a las bases viejas pierde las escrituras nuevas si no se transfieren. No prometer rollback de datos por un simple cambio DNS. Detener el candidato no elimina sus volúmenes.

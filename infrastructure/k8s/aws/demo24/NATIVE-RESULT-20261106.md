> **Estado vigente:** [cierre funcional y matriz actualizada](CLOSURE-20261106.md). Ocho tipos PDF y Community/PostgreSQL desplegados; ingesti?n simulada y regresiones aprobadas. Retorno GitHub pendiente de Chrome. El estado anterior de cinco reportes/Community pendientes es hist?rico.

# Despliegue real: 6 de noviembre de 2026

> Actualización posterior: las pruebas integrales de Chrome detectaron y corrigieron la importación CommonJS de Leaflet. Frontend usa ahora demo24-mapfix2-20261106, conservando la imagen release anterior. Pasaron 44 comprobaciones UI y la recuperación del outbox durante caída de Auditoría/reinicio del Gateway. Search Console no informa problemas según el propietario; la advertencia se limita al retorno real de GitHub y sigue pendiente. Ver [aceptación integral](INTEGRAL-ACCEPTANCE-20261106.md) para el estado vigente y sus límites.

URL comprobada: https://climateguard.garher.lat, EC2 existente EC2_PUBLIC_IP. K3s nativo v1.37.2+k3s1, nodo k3s-demo-node Ready. No se crearon recursos AWS, snapshots ni Scheduler; no se cambió el plan FREE. El saldo y snapshot completed fueron confirmados por el operador mediante CloudShell, no consultados independientemente desde esta sesión.

## Recursos y pruebas reales

- Nueve imágenes release-20261106-f0048fcb2ff2 importadas sin registry push. Community Service independiente permanece inactivo; Comunidades funciona mediante legacy-api compatible con sensores.
- Ocho Deployments disponibles: frontend (dos réplicas), gateway, auth-service, legacy-api, sensor-service, alert-service, audit-service y report-service. Cuatro StatefulSets listos: auth-db, alert-db, mongodb y sqlserver.
- Seis PVC Bound, 19 GiB declarados, StorageClass cg-retain. Bases nuevas; contenedores y datos anteriores conservados y detenidos.
- DNS de servicios y ocho readiness HTTP internos comprobados. Ingress Traefik local; no AWS Load Balancer. HTTP redirige a HTTPS. Certificado válido hasta el 6 de enero de 2027.
- 67 comprobaciones funcionales: login local, JWT, Viewer, permisos 401/403, refresh rotado/reutilización rechazada/logout, Comunidades, sensores, lectura manual, alerta sin duplicación, auditoría y tres PDF descargados.
- 31 comprobaciones de durabilidad: reinicios controlados de las cuatro bases nuevas y Report Service; PVC, usuarios, refresh, lectura, alerta, auditoría, historial y hashes PDF conservados.
- 23 comprobaciones OAuth: ambos proveedores configurados, inicio por Gateway, callbacks HTTPS exactos, PKCE S256, nonce Google, cookies Secure/HttpOnly/SameSite, rechazo de origen ajeno, vinculación anónima, estado sin cookie y repetido; cancelación procesada correctamente.
- Auth Service alcanzó discovery/JWKS de Google y API de GitHub con HTTPS 200. Esto no demuestra todavía consentimiento y retorno de una cuenta real de cada proveedor: requiere intervención humana.

Evidencias sanitizadas: [runtime-evidence-20261106.json](../../../../docs/PUBLICATION-VALIDATION.md). No contienen contraseñas, tokens ni valores de clientes OAuth. Las lecturas de prueba están identificadas TEST y son manuales; no se conectó Arduino ni se presentaron como mediciones físicas.

Muestra posterior al despliegue: 7776 MiB RAM total, 4767 MiB disponibles, sin swap; métricas de nodo 283m CPU y 2936 MiB; disco raíz 40 GiB libres. No constituye prueba de carga sostenida.

## Incidencias resueltas

Se corrigió ACCEPT_EULA como cadena YAML; SQL necesitó NET_BIND_SERVICE por la capability del ejecutable, conservando usuario no root y demás restricciones. Se incorporaron reintentos acotados de conexión durante el arranque CNI/PostgreSQL. Los Jobs fallidos históricos se conservaron; sus reintentos y los servicios finales quedaron correctos. Un falso negativo del comprobador OAuth se corrigió normalizando nombres de cabeceras HTTP.

## Pendientes y límites

1. Operador: iniciar sesión manualmente con Google y GitHub desde la URL pública. Confirmar retorno, Viewer para cuenta nueva, proveedor en refresh y vinculación explícita cuando corresponda. No compartir URL con códigos ni tokens.
2. Completar regresión visual en Chrome y pruebas independientes de bloqueo NetworkPolicy y recuperación de outbox durante caída de Auditoría. Las políticas aplicadas y la auditoría normal no equivalen a esas pruebas.
3. No se certifican ocho requisitos académicos: falta contrastar su rúbrica y solo existen tres tipos PDF (comunidades, sensores, lecturas). Community Service independiente no se activó por incompatibilidad del contrato sensorCount.
4. Coste exacto de cuenta y consumo de créditos no consultables desde esta sesión sin AWS CLI autenticado. No se añadieron servicios AWS; EC2/EBS/snapshots/IPv4 existentes pueden seguir consumiendo créditos. Apagado manual no elimina cargos de almacenamiento.

## Operación y recuperación

SSH, Docker, containerd y K3s activos. Servicios anteriores y Nginx detenidos/deshabilitados según cutover aprobado; sus datos permanecen. Conservar [CUTOVER-20261106.md](CUTOVER-20261106.md) y snapshot confirmado. No arrancar el despliegue anterior a la vez: compite por puertos y memoria. No se ejecutó rollback ni restauración del snapshot.

Por instrucción expresa, el apagado será manual desde AWS: climateguard-demo-stop.timer está not-found/inactive y no se creó Scheduler. No borrar PVC, volúmenes ni bases para apagar. K3s está habilitado al arranque; la IP pública puede cambiar tras detener/encender y requerir actualización DNS.

Verificación local adicional: 11 pruebas demo24 pasan; cinco scripts Linux sin CR/BOM; git diff --check del directorio k8s pasa. La repetición local de test_manifests.py quedó bloqueada por ausencia de PyYAML en el intérprete disponible, sin instalar dependencias globales.

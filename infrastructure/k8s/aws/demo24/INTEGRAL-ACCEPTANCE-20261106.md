> **Estado vigente:** [cierre funcional y matriz actualizada](CLOSURE-20261106.md). Ocho tipos PDF y Community/PostgreSQL desplegados; ingesti?n simulada y regresiones aprobadas. Retorno GitHub pendiente de Chrome. El estado anterior de cinco reportes/Community pendientes es hist?rico.

# Aceptación integral en AWS K3s — 6 de noviembre de 2026

URL: https://climateguard.garher.lat. Pruebas contra el despliegue real de la EC2 existente; no se crearon recursos AWS ni se cambió el plan. Sin commits, push, reset, borrado de datos ni modificación de credenciales Google.

## Resultado funcional

La última regresión HTTP reutilizó los datos TEST existentes y pasó 58 comprobaciones; la ejecución inicial tuvo 67 porque incluía creación de fixtures y generación inicial. La prueba de Chrome pasó 44 comprobaciones con cuentas técnicas Admin y Viewer, sin automatizar cuentas reales Google/GitHub ni desactivar Safe Browsing. Los 16 tests unitarios focalizados del dashboard/mapa pasan.

| Bloque operativo de evidencia | Resultado observado | Límite de cumplimiento |
|---|---|---|
| 1. Dashboard | Métricas comparadas con APIs, filtro de comunidad/sensor y lectura persistida dibujada; mapa visible en Chrome | Comunidad TEST sin coordenadas: se informa sin marcador; no se inventan ubicaciones ni mediciones físicas |
| 2. Comunidades | Consulta HTTP/UI, asociación y sensorCount conservados; actualización auditada por Gateway | Implementación compatible legacy-api/SQL Server; Community/PostgreSQL independiente sigue pendiente |
| 3. Sensores y lecturas | Consulta UI, lectura manual persistida, unidad, filtros y evaluación Java idempotente | Sin Arduino conectado; no se certificó ingestión física ni comunicación real de hardware |
| 4. Alertas | Lectura manual fuera de umbral produce alerta persistida, sin duplicar al reevaluar; listado UI accesible | No se ejercitó resolución desde UI en esta ejecución ni todos los fenómenos/severidades |
| 5. Reportes | Tres tipos generados y descargados desde Chrome, filtros por sensor, historial conservado tras recarga | Cinco tipos adicionales pendientes; no se certifican todos los campos formales de los tres tipos existentes |
| 6. Auditoría | Consulta Admin; Viewer 403; eventos CONFIRMED; caída/reinicio y recuperación de outbox sin duplicado | No equivale a una auditoría de seguridad completa ni a pruebas de carga |
| 7. Autenticación y permisos | Login local Admin/Viewer, JWT alterado 401, permisos 403, refresh rotado y revocado, guards UI, protocolo OAuth 23/23; Google real confirmado por usuario | GitHub llega a autorización, pero Chrome bloquea retorno real; vinculación y refresh de identidades externas no certificados end-to-end |
| 8. Plataforma y persistencia | Nodo Ready, ocho Deployments disponibles, cuatro bases listas, seis PVC Bound/Retain; DNS/readiness/HTTPS; frontend dos réplicas; pruebas de durabilidad y aislamiento | Un nodo, sin alta disponibilidad; restauración del snapshot y carga sostenida no probadas |

Estos ocho bloques organizan las pruebas; **no sustituyen una rúbrica académica de ocho requisitos ni significan 8/8 aprobado**. La [especificación pública de Fase 3](https://github.com/melgust/desaweb2026b/blob/main/phase_3.md) también pide Compose y separación Community/PostgreSQL; K3s y la compatibilidad actual no acreditan automáticamente esos puntos. Los PDF disponibles cubren comunidades, sensores y lecturas. Faltan alertas, eventos, estado de sensores, estadísticas y ejecutivo. Historial y descarga tienen evidencia real.

## Fallo encontrado y corregido

El dashboard fallaba al inicializar Leaflet en el bundle de producción: el módulo CommonJS expone default y el componente usaba directamente el namespace. Se respaldó monitoring-map.ts fuera del repositorio antes de editar. La corrección admite default o namespace mediante comprobación explícita, conservando compatibilidad de los mocks y tests existentes. La primera variante funcionó en Chrome pero dos tests detectaron la necesidad de no acceder a un export inexistente en el mock; la variante final pasa los 16 tests.

Imagen final del frontend: climateguard/frontend:demo24-mapfix2-20261106. Build de producción correcto; advertencias de presupuesto CSS y CommonJS no bloqueantes. Transferencia directa Docker→SSH→containerd, sin registro ni recursos AWS. Las imágenes anteriores permanecen para rollback. Las demás aplicaciones conservan release-20261106-f0048fcb2ff2; community-service está importado pero no activo.

[Identidad de imagen y hash del archivo fuente](../../../../docs/PUBLICATION-VALIDATION.md). El release-lock original documenta las nueve imágenes iniciales: no se reescribió para fingir que incluía esta corrección. Los candidatos 03-applications.yaml y complete.yaml reflejan la imagen corregida; los generadores históricos siguen ligados a la release original y deben aplicar explícitamente el hotfix al regenerar. No aplicar complete.yaml indiscriminadamente a las bases existentes.

## Resiliencia y aislamiento reales

- Durabilidad previamente ejecutada: 31 comprobaciones pasan tras reemplazar los Pods de las cuatro bases nuevas y Report Service. Se conservaron identidad de PVC, usuario, refresh, lectura, alerta, auditoría, metadatos y hashes de tres PDF. No se restauró el snapshot.
- Outbox: 14 comprobaciones pasan. Se detuvo únicamente el Deployment nuevo de Auditoría; una actualización idempotente de la comunidad TEST devolvió 204 y quedaron dos elementos en cola. Se reemplazó el Pod del Gateway con Auditoría aún fuera de línea. Al restaurarla hubo exactamente un nuevo evento CONFIRMED para esa actualización y la cola se vació. Auditoría se restaura en finally. No se tocaron las bases anteriores.
- Aislamiento: DNS y acceso permitido de Auditoría a MongoDB funcionan. Desde el Pod real de Auditoría se rechazaron conexiones a SQL Server, auth-db y Auth Service; los tres destinos sí aceptaban conexiones desde el nodo. Los contadores REJECT de tres cadenas aumentaron en uno. Kube-router usa icmp-port-unreachable, por lo que el rechazo aparece como ECONNREFUSED; el primer comprobador esperaba timeout y se corrigió para verificar rechazo/contadores, sin relajar políticas.
- Chrome canceló algunas lecturas al cambiar de ruta (ERR_ABORTED); no hubo respuestas HTTP 4xx/5xx en el recorrido UI aprobado. No se registraron cuerpos de login, almacenamiento de sesión, códigos, tokens, cookies ni queries OAuth.

## Evidencias

- [HTTP, persistencia, OAuth, aislamiento, outbox y estado del clúster](../../../../docs/PUBLICATION-VALIDATION.md).
- [Resultado UI con estados HTTP y hashes PDF](../../../../docs/PUBLICATION-VALIDATION.md).
- [Dashboard Admin](../../../../docs/PUBLICATION-VALIDATION.md), [dashboard Viewer](../../../../docs/PUBLICATION-VALIDATION.md), [Comunidades](../../../../docs/PUBLICATION-VALIDATION.md), [Sensores](../../../../docs/PUBLICATION-VALIDATION.md), [Alertas](../../../../docs/PUBLICATION-VALIDATION.md), [Auditoría](../../../../docs/PUBLICATION-VALIDATION.md), [historial de reportes](../../../../docs/PUBLICATION-VALIDATION.md).
- PDF descargados por Chrome: [comunidades](../../../../docs/PUBLICATION-VALIDATION.md), [sensores](../../../../docs/PUBLICATION-VALIDATION.md), [lecturas](../../../../docs/PUBLICATION-VALIDATION.md). Datos persistidos de prueba técnica manual; no observaciones físicas. Se verificaron firma PDF, tamaño y SHA256; no se certificó visualmente todo el diseño ni cada campo académico.

Las capturas y PDF contienen nombres/correos de cuentas técnicas y registros de prueba, sin credenciales. Se conservaron los documentos generados en el historial, sin eliminarlos.

## GitHub y Search Console

El propietario verificó garher.lat por DNS TXT y reporta «No se ha detectado ningún problema» en Search Console. Login y callback sin parámetros abren normalmente en su Chrome; solo se bloquea el retorno de GitHub. No hay evidencia de bloqueo general del dominio, pero el problema del retorno sigue abierto. No se cambian rutas para eludirlo ni se desactivan protecciones. Google permanece operativo según la prueba humana. [Investigación y cabeceras aplicadas](SAFE-BROWSING-20261106.md).

## Operación y pendientes prioritarios

Los servicios antiguos y sus volúmenes permanecen detenidos e intactos; SSH, Docker, containerd y K3s operativos. Sin timer de apagado ni Scheduler; encendido/apagado manual del propietario. Última muestra previa a la validación final: 4417 MiB RAM disponibles, 40 GiB de disco libres, nodo 141m CPU/3197 MiB; consultar el JSON final para la muestra más reciente. No es una prueba de carga ni confirma saldo actual de créditos.

Prioridad: investigar el retorno GitHub con Chrome y el propietario sin exponer su query; contrastar la rúbrica exacta; completar cinco tipos PDF y los campos faltantes; después separar Community/PostgreSQL conservando el contrato sensorCount. Mantener pendientes forwarded headers/rate limiting tras Ingress y validación granular de capabilities en Report Service, documentados en el informe AWS anterior. No ampliar alcance ni sustituir datos para aparentar cumplimiento.

Rollback del frontend: establecer la imagen anterior conservada release-20261106-f0048fcb2ff2 y esperar rollout; recupera la versión anterior, incluido su fallo de mapa. Para el resto, seguir CUTOVER-20261106.md; nunca iniciar simultáneamente despliegue anterior y nuevo. No se ejecutó rollback de datos.

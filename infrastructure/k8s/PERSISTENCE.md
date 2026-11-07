# Persistencia, capacidad y escalabilidad

## Volúmenes y propietarios

| Datos | Recurso / PVC | Solicitud inicial | Montaje |
| --- | --- | --- | --- |
| PostgreSQL Auth | StatefulSet auth-db / `data-auth-db-0` | 20 Gi | `/var/lib/postgresql/data`, PGDATA subdirectorio |
| PostgreSQL Alert | StatefulSet alert-db / `data-alert-db-0` | 20 Gi | Igual, instancia separada |
| MongoDB Reports/Audit | StatefulSet mongodb / `data-mongodb-0` | 20 Gi | `/data/db`, usuarios por base |
| SQL compartido | StatefulSet sqlserver / `data-sqlserver-0` | 40 Gi | `/var/opt/mssql` |
| PDFs | PVC report-pdfs | 10 Gi | Ruta exacta `app/generated` de Report Service |
| Cola de auditoría | PVC gateway-outbox | 2 Gi | `/var/lib/climateguard/audit-outbox` |
| Community opcional | StatefulSet community-db, 0 réplicas | 20 Gi cuando se habilite | No forma parte del flujo compatible |

No se referencian volúmenes Docker existentes ni rutas hostPath del servidor. Son nombres/namespaces propios, no una adopción implícita. Se requiere migración/restauración explícita de datos, no solo crear PVCs vacíos.

Los StatefulSets retienen sus PVC al borrar/escalar el controlador. Nunca usar `delete namespace`, `delete pvc`, `down -v` o un prune automático como procedimiento de actualización. Revisar también reclaimPolicy del PV/StorageClass. `local-path` es el valor inicial parametrizable para K3s, no garantía de HA ni cuota física reservada. Una falla del nodo/disco puede perder los datos; los snapshots/backups deben salir del nodo y probarse mediante restauración. [Semántica de PV/PVC](https://kubernetes.io/docs/concepts/storage/persistent-volumes/).

## Estado local y HPA

- **Gateway: una réplica, Recreate, PVC exclusivo.** Dos workers de archivos compitiendo por la cola pueden interferirse. RWO es restricción por nodo, no un lock entre Pods. Se preserva la entrega pendiente, no se sustituye el outbox por emptyDir. Para escalar: migrar primero a una cola compartida con leases/consumidores e idempotencia verificadas.
- **Report: una réplica, Recreate, PVC exclusivo.** Mongo guarda metadatos pero los bytes PDF están en disco. Una réplica distinta sin el mismo archivo produciría errores de descarga. El perfil limita la concurrencia de Uvicorn a 4. Para escalar: almacenamiento de objetos o CSI RWX probado, rutas estables, backups consistentes y pruebas concurrentes. No se cambió el generador que está ampliando Edwin.
- **Auth: una réplica y Recreate.** Usuarios/roles y refresh están en PostgreSQL, pero la rotación de refresh actual hace lectura/revocación/emisión en varios pasos. Recreate evita añadir otra réplica durante un rollout; no resuelve por sí mismo la carrera entre solicitudes concurrentes. No se activa HPA hasta hacerla atómica y probar concurrencia, en coordinación con Julieta y OAuth/OIDC.
- **HPA opcional:** frontend, Sensor (estado/outbox SQL), Alert (persistencia/idempotencia PostgreSQL) y Audit (Mongo con índice único). CPU al 70%, mínimo 1; máximo 3 salvo Alert 2; estabilización 60 s al subir y 300 s al bajar. Son candidatos arquitectónicos, no escalabilidad demostrada.
- No hay HPA para bases de datos ni se convierte una instancia de base en HA aumentando réplicas.

Metrics Server/API de recursos y requests de CPU son requisitos para el HPA. Deben comprobarse antes de habilitar el overlay y medirse disponibilidad, carga, pool de conexiones, latencia, duplicados y consumo. [HPA oficial](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).

## Capacidad del perfil, no de la instancia AWS

Requests calculados desde los YAML de single-node: **2425 millicores y 5024 MiB**, más sistema operativo, K3s, Ingress, DNS, Metrics Server, caché, picos y servicios previos. La suma de límites de memoria es aproximadamente **11,625 GiB**; no es consumo medido ni reserva adicional garantizada. PVC solicitados: **112 GiB**, sin contar imágenes, logs, snapshots y backups.

Como presupuesto inicial de laboratorio, considerar 4 vCPU/16 GiB RAM y capacidad útil de disco superior a esos PVC y sus respaldos; no es recomendación de compra ni prueba de que el servidor existente alcance. No programar todas las bases en una instancia pequeña solo porque K3s inicia. El mínimo propio de [K3s](https://docs.k3s.io/installation/requirements) no incluye la carga de ClimateGuard.

Con todos los HPA en máximos: requests aproximados 3125m/6368Mi, pero los límites agregados de memoria se acercan a 15,375 GiB sin el sistema. Un nodo de 16 GiB no tiene margen para esos máximos simultáneos. Ajustar los HPA/cargas o aportar capacidad después de medir, sin asumir que AWS ya la tiene.

SQL Server se limita internamente a 2048 MiB con límite de Pod 3 GiB, para dejar margen al proceso. Su imagen exige nodo Linux amd64, indicado por nodeSelector; verificar arquitectura real de AWS, no asumir compatibilidad con ARM. `MSSQL_PID=Developer` es un perfil de desarrollo/pruebas; revisar licencia antes de otro uso. No se inventó licencia productiva.

## Recuperación consistente

Restaurar SQL junto con PostgreSQL Alert y sus recibos/idempotencia; preservar IDs de sensores/comunidades/lecturas. El namespace de measurementId actual contiene `ClimateGuard`: usar otra base sin revisar ese contrato puede provocar colisiones entre datos restaurados.

Restaurar MongoDB Reports junto con todos los PDF a la misma ruta de montaje; los metadatos sin archivos no bastan. Guardar también Mongo Audit, PostgreSQL Auth/roles/refresh y la cola persistente de Gateway. Antes del corte hay que detener o controlar escrituras y planificar la delta; dos despliegues escribiendo en bases divergentes no son una estrategia de rollback.

No se exportaron datos ni se hicieron backups en esta tarea. El estado y los mecanismos actuales de AWS siguen pendientes de inventario.

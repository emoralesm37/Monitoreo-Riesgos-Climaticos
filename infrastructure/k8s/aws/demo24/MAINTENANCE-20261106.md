> **Estado vigente, 6 de noviembre de 2026:** cutover autorizado ejecutado; K3s y aplicaciones desplegados, HTTPS operativo. Ver [resultados reales](NATIVE-RESULT-20261106.md). Los diagn?sticos previos de este documento son hist?ricos. No hay apagado autom?tico; no crear Scheduler.

# Ventana autorizada — comprobaciones previas

6 de noviembre de 2026, Guatemala. El usuario autorizó sustitución controlada e instalación K3s en la EC2 existente, **condicionada primero a verificar `snap-REPLACE_SNAPSHOT_ID` completado**. No se solicitó una segunda autorización de mantenimiento ni se inició otra infraestructura.

## Resultado observado en esta ventana

- SSH con verificación estricta de host funciona en `EC2_PUBLIC_IP`.
- DMI de la EC2 devuelve exactamente `i-REPLACE_INSTANCE_ID`, coincidente con el destino autorizado.
- Nginx, Docker y containerd continúan activos; ningún servicio antiguo fue detenido/deshabilitado. No se ejecutaron scripts de cutover ni instalación.
- No hay AWS CLI configurado localmente ni en EC2. Existe boto3 en EC2, pero una consulta limitada `DescribeSnapshots` sobre el snapshot autorizado devolvió `NoCredentialsError`. **No se verificó el estado del snapshot**, y por ello no se inició la parada.
- Se solicitó el resultado de `describe-snapshots` desde la sesión autenticada CloudShell del usuario. No se solicitaron claves o tokens; no se modificó el plan FREE ni se crearon snapshots/recursos.
- UFW inactivo; políticas INPUT de IPv4/IPv6 ACCEPT. Antes de arrancar el API K3s debe verificarse el Security Group existente. Se solicitaron las reglas mediante una consulta de solo lectura; no se abrió ningún puerto.

## DNS y HTTPS: resultados nuevos

La consulta Google DNS A ya no reproduce el SERVFAIL observado anteriormente: devuelve `climateguard.garher.lat → PREVIOUS_EC2_PUBLIC_IP`, TTL 1800. Esa es la **IP anterior**, no el servidor autorizado actual. NS de `garher.lat` vuelve a responder con `launch1.spaceship.net`/`launch2.spaceship.net`; la SOA también responde. No se atribuye una causa definitiva al SERVFAIL transitorio ni se modificaron DNS/DS/nameservers.

Una conexión HTTPS directa a `EC2_PUBLIC_IP`, conservando hostname/SNI `climateguard.garher.lat` y validación TLS normal, respondió **HTTP 200**, certificado válido hasta **6 de enero de 2027 01:48:13 UTC**. Esto valida el sitio anterior en la IP nueva por resolución explícita; **no demuestra resolución DNS pública correcta ni despliegue de la release K3s**. No se accedió a la clave TLS ni a cuentas reales.

Acción DNS pendiente del propietario: revisar el registro A en el proveedor existente y apuntarlo a `EC2_PUBLIC_IP`, conservando el dominio. Validar luego desde al menos dos resolvers; no cambiar delegación/DS sin diagnóstico. No se ejecutó ese cambio.

## Puertas antes de continuar

1. Confirmar `SnapshotId=snap-REPLACE_SNAPSHOT_ID`, `State=completed`, `Progress=100%` y el volumen correspondiente. Si el estado es distinto o el acceso falla, no detener servicios.
2. Confirmar reglas existentes de Security Group antes de iniciar K3s; no exponer 6443/10250/8472 a Internet ni alterar infraestructura sin alcance autorizado.
3. Revalidar identidades y ejecutar el cutover ya autorizado de `CUTOVER-20261106.md`; comprobar RAM/disco/puertos después de cada fase.
4. Instalar los artefactos nativos fijados sin arranque automático; iniciar y verificar nodo/CoreDNS únicamente si pasan las puertas anteriores.
5. Reportar el nodo real. Los microservicios, Secrets, migraciones, PDFs, OAuth e aislamiento siguen pendientes de pruebas posteriores.

El rollback preparado y los contenedores/volúmenes originales se conservan. **Estado actual del nodo K3s: no instalado; mantenimiento aún no iniciado por condición de snapshot pendiente.**

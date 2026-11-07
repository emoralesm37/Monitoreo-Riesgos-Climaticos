# Rotacion local de root: pendiente de autorizacion y ejecucion

El volumen logico `mongodb_data` tiene nombre fisico
`climateguard-mongodb-data`. Cambiar una variable de Compose no cambia la clave
guardada en ese volumen. Una clave que comienza por `REPLACE_WITH_` puede ser la
clave real si fue usada en la primera inicializacion; no basta sincronizarla.

## Antes de ejecutar

- Verificar que se trabaja con el contenedor local `climateguard-mongodb`, MongoDB
  7 y el volumen mencionado. Tener una copia de seguridad local comprobada de
  los datos segun el procedimiento del equipo, sin borrar el volumen.
- Conservar la clave actual y generar una nueva aleatoria en un gestor de claves.
  No habilitar transcripcion, tracing, depuracion ni grabacion de terminal.
- No editar `.env` ni ejecutar Compose o scripts de usuarios simultaneamente.
- Revisar y aceptar la transicion del healthcheck descrita abajo. No es una
  operacion atomica entre MongoDB y el sistema de archivos; una interrupcion del
  host o Docker puede requerir recuperacion manual con las claves conservadas.

## Comando PowerShell (NO ejecutado durante la preparacion)

```powershell
Set-Location C:\Users\USER\Desktop\Gerardo\ClimateGuard
& .\infrastructure\mongodb\rotate-root-password.ps1
```

El script autentica primero con `MONGO_INITDB_ROOT_*` del contenedor, sin sacar
la clave actual a la terminal. Verifica el usuario esperado y rol root. Solicita
la nueva clave dos veces con `Read-Host -AsSecureString`: minimo 24 caracteres,
mayusculas/minusculas/numeros/simbolos; sin comilla simple ni saltos de linea para
compatibilidad con el lector dotenv existente. Usar un valor aleatorio de un
gestor, no una frase predecible. No se acepta el prefijo de plantilla.

Las credenciales nuevas pasan a mongosh mediante stdin redirigido: no argumentos,
variables de entorno ni archivos temporales. Se cambia unicamente la clave del
usuario `climateguard_local_root` en `admin`, sin cambiar sus roles. Se autentica
en conexiones nuevas antes de escribir `.env` en UTF-8 sin BOM; otras variables
se conservan. Las cadenas necesariamente existen en memoria durante el proceso;
SecureString no ofrece borrado garantizado de todas las copias de memoria.

Ante un fallo ordinario se intenta restaurar la credencial anterior y conservar
el archivo previo. Si no se confirma la restauracion, no repetir a ciegas ni
reiniciar: conservar ambas claves y revisar el estado manualmente sin imprimirlas.
No hay garantia de rollback ante corte de energia o perdida de conexion.

## Transicion necesaria del contenedor actual

El healthcheck actual usa `MONGO_INITDB_ROOT_PASSWORD` del entorno del contenedor,
que **no puede actualizarse en un contenedor existente**. Tras rotar, el ping
autenticado fallara y el contenedor podra marcarse unhealthy aunque MongoDB siga
funcionando. El healthcheck existente usa `--password` como argumento; el script
de rotacion no lo utiliza ni modifica. Endurecer ese healthcheck queda pendiente.

Para recuperar consistencia completa se necesitara autorizar una recreacion
controlada posterior **del contenedor, nunca del volumen**. No se incluye en el
script ni se ejecuta en esta tarea. En esa tarea posterior:

1. Confirmar que la nueva clave funciona, `.env` tiene esa clave y no hay variables
   de proceso `MONGO_ROOT_USERNAME/PASSWORD` sobreescribiendo el archivo. No
   mostrar valores; Compose da prioridad a las variables del proceso.
2. Validar Compose con `config --quiet` y el `.env` explicito; no imprimir su
   configuracion completa ni el entorno del contenedor.
3. Verificar el montaje existente de `/data/db` y recrear solamente `mongodb`
   con el mismo proyecto y volumen. No usar `down -v`, `volume rm`, `--renew-anon-volumes`
   ni comandos de inicializacion. Revisar primero una mejora del healthcheck para
   evitar credenciales en argumentos.
4. Verificar healthy y autenticacion root con el nuevo entorno. La imagen no
   reinicializa el volumen existente y el cambio ya persistido sigue vigente.
5. Ejecutar `create-users.ps1` solo con autorizacion separada. Usa el `.env`
   actualizado y no modifica usuarios ya existentes.

Hasta completar esa tarea, Compose tiene la credencial futura correcta, pero el
entorno y healthcheck del contenedor actual siguen desactualizados. No presentar
la rotacion como una transicion sin interrupciones ni como validada en ejecucion.

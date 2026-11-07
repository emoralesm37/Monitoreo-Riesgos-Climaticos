# Arduino USB -> ClimateGuard HTTPS

Ejecutar en el Windows donde esta conectado el Uno. No instalar este puente en
la VPS si el cable USB esta conectado a Windows. K3s/Gateway reciben HTTPS sin
puertos adicionales. No se cambia infraestructura AWS.

## Uso preparado para este equipo

1. Cargar `../arduino/ClimateGuardUno/ClimateGuardUno.ino`, TRIG D9, ECHO D8, DHT D2.
2. Cerrar Monitor Serie y Serial Plotter. COM7 debe estar disponible.
3. Ejecutar en PowerShell desde la raiz del repositorio:

```powershell
py -m pip install -r hardware/bridge/requirements.txt
powershell -ExecutionPolicy Bypass -File hardware/bridge/Start-Bridge.ps1
```

Ctrl+C detiene el proceso visible. Para una ejecucion de fondo preparada por el
operador, usar `Stop-Bridge.ps1`: solicita salida y conserva la cola, sin apagar AWS.
No ejecutar dos puentes simultaneamente sobre el mismo puerto/cola.

Configuracion privada: `%LOCALAPPDATA%\ClimateGuard-private\arduino-bridge.json`.
Contiene cuenta tecnica Operador, tres sensores, dispositivos y puerto. No copiar
este archivo al repositorio ni compartirlo. Sus permisos Windows se restringieron
al usuario actual y SYSTEM. La cola `readings.sqlite3` y logs tambien quedan alli.
Para cambiar COM, editar solo `port` en el archivo privado con el puente detenido.
No abrir el archivo privado en capturas o copiarlo a informes publicos.

## Datos y recuperacion

Una captura serial valida crea solicitudes independientes para temperatura C,
humedad % y nivel m. La hora UTC es recepcion en el PC, no reloj del Arduino.
`null` se omite; el nivel requiere `water_calibrated=true`. La distancia cruda no
se publica como nivel. No se crean datos simulados para llenar canales faltantes.

SQLite WAL con synchronous FULL persiste el cuerpo, UUID y fecha antes del envio.
Al reiniciar se reenvia el mismo sobre. HTTP 200/201 confirma recibo; duplicate
conserva la lectura existente. Errores permanentes quedan como rejected para
revision; no se cambian IDs para eludir 409. HTTP 429 espera al menos 60 segundos;
fallos temporales esperan y conservan pendientes. Las capturas mayores a siete
dias pueden ser rechazadas por la API y requieren revision, no fechas inventadas.

JWT y refresh se mantienen en memoria; el refresh se rota y se cierra sesion al
salir normalmente. HTTPS verifica certificado y rechaza redirecciones. Los logs
no muestran credenciales/tokens/cuerpos. El firmware no almacena claves.

El loop serial y red es secuencial: durante una caida prolongada puede perder
capturas que excedan el buffer USB; no es un datalogger de adquisicion continua.
Solo garantiza reintentos durables de las capturas ya guardadas en SQLite.

## Pruebas

```powershell
py -m unittest discover -s hardware/bridge -v
```

Las pruebas verifican descarte de null/no calibrado, rangos, unidades, UUIDs,
durabilidad/reintento identico, retencion de conflictos y rotacion de refresh.
Con hardware, buscar eventos captured y persisted en consola. Verificar sensor,
valor y fecha en Sensores/dashboard; el dashboard se actualiza al consultar, no
promete streaming. AlertEvaluationPending=true significa evaluacion pendiente,
no una alerta confirmada. No modificar umbrales de produccion solo para generar
una alerta; revisar reglas y probar con condiciones medidas y autorizadas.

La calibracion del nivel y pruebas fisicas de distancia no se sustituyen por
compilacion ni tests de software. Las coordenadas de la comunidad no se inventan.

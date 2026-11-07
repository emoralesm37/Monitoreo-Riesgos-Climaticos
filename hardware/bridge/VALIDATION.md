# Validacion fisica USB -> HTTPS -> K3s

Fecha de trabajo: 6 de noviembre de 2026, Guatemala.

- Uno R3 en COM7; DHT11 DATA D2; HC-SR04 TRIG D9, ECHO D8.
- Referencia cero de 30 cm proporcionada por el operador; firmware compilado y
  cargado con Arduino CLI. Programa 6342 bytes, RAM global 219 bytes.
- Cuenta tecnica Operador y tres dispositivos/sensores vinculados mediante API
  administrativa; configuracion privada fuera del repositorio con ACL restringida.
- Temperatura y humedad fisicas persistidas con HTTP 201; posteriormente nivel
  relativo derivado de eco fisico tambien confirmado con HTTP 201. No se afirma
  que todo eco observado corresponda a superficie de agua; requiere montaje real.
- Primera prueba: 32 lecturas confirmadas y cola sin pendientes al revisar.
  Despues se dejo funcionando el puente; los contadores posteriores cambian.
- Repeticion del sobre de una lectura fisica: HTTP 200, duplicate=true,
  mismo sensorReadingId. Sin autenticacion: 401. Dispositivo sin vincular: 403.
- Refresh rotado; reutilizacion del refresh anterior rechazada con 401.
- Respuestas de ingestion verificadas con alertEvaluationPending=false. Esto
  confirma evaluacion terminada, no implica que una regla haya disparado alerta.
- Chrome real: estacion con tres sensores; graficas de temperatura/humedad
  con lecturas persistidas. Capturas y logs retenidos solo en almacenamiento privado.
- Seis tests unitarios del puente aprobados: datos ausentes/rangos, calibracion,
  identidad, persistencia/reinicio, conflictos y rotacion de refresh.

Pendientes de campo: estabilizar los ecos intermitentes del HC-SR04, confirmar
calibracion y nivel frente a una regla fisica y verificar umbrales apropiados con
el responsable. No se modificaron reglas para forzar alertas, ni se inventaron
coordenadas. La validacion fisica de todas las condiciones de alerta no se declara
completada. El PC debe mantenerse encendido, conectado por USB e Internet.

No se crearon recursos AWS, ni se modificaron plan FREE o despliegues K3s.
No se incluyen credenciales, datos de autenticacion, colas, logs ni capturas.

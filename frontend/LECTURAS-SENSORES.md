# Consulta local de lecturas

En **Sensores**, la acción **Ver lecturas** consulta a través del Gateway:

`GET /api/sensors/{id}/readings?limit=100`

Se espera un arreglo de `{ sensorReadingId, sensorId, value, timestamp }`, según
`SensorReadingDto` y `SensorsController` del contrato compatible de esta rama.
La pantalla muestra hasta 100 lecturas, ordenadas por fecha descendente, con
actualización manual, reintento, nombre y unidad del sensor. Las fechas se
presentan en la zona horaria del navegador. Cero es un valor válido; una lista
vacía no indica desconexión.

## Requisitos del entorno

- Auth y un usuario de pruebas disponibles para iniciar sesión.
- Sensor Service con el contrato compatible ya configurado por el equipo.
  Confirmar `Sensor:UseSharedDatabase` en la configuración efectiva: este cambio
  no modifica el modo ni las bases de datos. El modo independiente ofrece un
  contrato paginado diferente y no es compatible con esta consulta.
- Bases de datos exclusivamente locales/de pruebas, sin inicializar ni migrar
  bases de producción.
- JWT del Gateway compatible con el emisor del entorno, inyectado por el
  mecanismo existente de configuración. No guardar claves en este documento.

## Arranque sin Docker

Desde la raíz del repositorio, en terminales separadas:

```powershell
dotnet run --project services/sensor-service/ClimateGuard.Sensor.Api --launch-profile http
dotnet run --project gateway/ClimateGuard.Gateway --launch-profile http
cd frontend
npm start
```

El perfil HTTP de sensores escucha en `localhost:5026`. La configuración
Development del Gateway apunta a ese puerto. Angular consume
`http://localhost:5147/api`; abrir `http://localhost:4200`, iniciar sesión y
entrar a **Sensores → Ver lecturas**. El arranque de Auth y las bases depende
de la configuración local existente del equipo.

En Network del navegador comprobar la URL del Gateway, `limit=100`, respuesta
200 con arreglo y el encabezado Bearer (sin copiar ni compartir su valor).
Comprobar actualización, vacío y errores con datos/control del entorno de
pruebas. La interfaz no escribe mediciones.

## Gateway/Nginx en Docker, APIs en el anfitrión

`infrastructure/compose/compose.local.yml` usa APIs ejecutadas en el anfitrión.
El destino por defecto de sensores es `http://host.docker.internal:5026/`.
Puede sobrescribirse con `SENSOR_SERVICE_URL`; no usar localhost del contenedor
para referirse al anfitrión. Comprobar que la dirección de escucha del servicio
sea accesible desde Docker Desktop; el perfil localhost puede necesitar un
binding explícito aprobado para la red local de pruebas.

Con Docker Desktop iniciado y las variables JWT del entorno ya configuradas:

```powershell
docker compose -f infrastructure/compose/compose.local.yml up --build -d
```

Detener primero el Gateway nativo para liberar el puerto 5147. Este Compose no
levanta Sensor Service, Auth ni sus bases. El modo ASPNETCORE Production del
contenedor se usa con destinos locales explícitos; no se modificó el destino
de sensores en `appsettings.json` para despliegues de producción.

## Verificación automatizada

```powershell
cd frontend
npm run build
npm test -- --watch=false --include=src/app/features/sensores/sensores.spec.ts
cd ..
dotnet build gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj
```

Las pruebas Angular simulan respuestas HTTP: cubren consulta de usuarios sin
permisos administrativos, URL/contrato, orden, cero, carga, error/reintento,
vacío, actualización y cancelación al seleccionar otro sensor. No acreditan
persistencia ni comunicación con sensores físicos.

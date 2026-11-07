# Integración de alertas y preparación de lecturas físicas

## Inventario del 5 de noviembre de 2026

Referencias actualizadas con `git fetch origin`, sin pull ni merges. Rama de
trabajo `feature/frontend-alertas-api`, creada desde
`feature/frontend-lecturas-sensores` (HEAD `94e4998`) conservando sus cambios.

- `origin/Dev`: `693ade2`, incorpora Alert Service y evaluación de reglas.
- `origin/feature/fase3-alert-service`: `e60c17b`, Java/Spring Boot, PostgreSQL,
  JWT, consulta filtrada y resolución.
- `origin/feature/fase3-alert-rules`: `54b9ef9`, evaluación y prevención de
  alertas activas repetidas. No equivale a deduplicación de mensajes físicos.
- `origin/feature/fase3-community-service`: `b7076b8`, servicio independiente.
- `origin/feature/fase3-auth-completion`: `dd365bf`, usuarios/roles y guards.
- `origin/feature/fase3-edwin-microservices`: `6b66b26`, sensores independientes,
  pruebas y trabajo inicial de Report Service/MongoDB.

No se copiaron servicios backend ni ramas completas. Se integró selectivamente
su contrato en frontend/Gateway. La variante independiente de sensores sigue
difiriendo en DTO, estado, reset y consulta paginada: no reemplazar el contrato
actual de lecturas sin adaptar y probar esas operaciones. Community Service
también requiere acordar IDs y el conteo de sensores.

## Requisitos y alcance

- Fase 3, secciones 6 y 10: Gateway y gestión/evaluación de alertas. Secciones
  11–15: reportes generados en backend e integración al dashboard.
- Fase 4: identidad externa centralizada, JWT y Kubernetes/K3s manteniendo
  dominio y HTTPS. No están completados por este cambio.
- Requisito adicional comunicado por el ingeniero: Arduino Uno, sensores
  físicos y puente USB/serial. No figura en los dos documentos escritos; se
  incorpora como requisito adicional confirmado por el usuario.
- Fuentes: https://github.com/melgust/desaweb2026b/blob/main/phase_3.md y
  https://github.com/melgust/desaweb2026b/blob/main/phase_4.md.

## Contrato integrado

Fuente: `54b9ef9`, `services/alert-service/src/main/java/com/climateguard/alert/`:
`api/AlertController.java`, `service/AlertService.java`, `domain/Alert.java` y
`config/SecurityConfig.java`.

- GET `/api/alerts?status=ACTIVA`: arreglo AlertResponse, severidades y estados
  en mayúsculas. Incluye IDs, sensorName, communityName, phenomenon, message,
  triggerValue, createdAt, resolvedAt y resolvedByUserId.
- PATCH `/api/alerts/{id}/resolve`: devuelve AlertResponse. Escritura autorizada
  para Administrador/Operador y ADMIN/OPERATOR. Consultas requieren JWT.
- Angular usa exclusivamente `environment.apiUrl`; su interceptor existente
  adjunta Bearer. El Gateway conserva ruta, parámetros y cuerpo.
- Se retiraron ejemplos y escrituras de localStorage de la pantalla Alertas.
  Resolver solo retira la alerta después de éxito del servidor.
- El historial y los indicadores de alertas del dashboard siguen usando datos
  locales anteriores: son pendientes separados, no evidencia del estado del
  servicio. Esta pantalla ya no escribe un historial ficticio.

## Arranque y verificación local

El servicio externo espera por defecto el puerto 7301 (application.properties).
El Gateway usa `http://localhost:7301/`; se puede sobrescribir con la variable
`ReverseProxy__Clusters__alert-service__Destinations__primary__Address`.
Compose local utiliza APIs en el anfitrión y por defecto
`http://host.docker.internal:7301/`, configurable con `ALERT_SERVICE_URL`.

Para datos reales, el responsable debe entregar Alert Service arrancado con
PostgreSQL **de pruebas**, esquema preparado por él y JWT compatible con Auth y
Gateway. No ejecutar inicializaciones/migraciones contra producción. Este
cambio no instala ni levanta Java/PostgreSQL ni integra su rama backend.

Con esos servicios disponibles, desde la raíz:

```powershell
dotnet run --project gateway/ClimateGuard.Gateway --launch-profile http
cd frontend
npm start
```

Abrir http://localhost:4200, iniciar sesión y entrar en Alertas. En Network,
comprobar GET a localhost:5147/api/alerts?status=ACTIVA. Resolver con un rol
permitido debe enviar PATCH al mismo Gateway. Sin servicio disponible debe
aparecer error y reintento, nunca alertas de ejemplo.

```powershell
cd frontend
npm run build
npm test -- --watch=false --include=src/app/features/alertas/alertas.spec.ts --include=src/app/features/sensores/sensores.spec.ts
cd ..
dotnet build gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj
```

Las pruebas de pantalla usan respuestas HTTP simuladas. No prueban la base de
datos ni la generación real de alertas.

## Contrato actual y preparación de Arduino

Recorrido requerido: Arduino → puente USB/serial → HTTPS/Gateway → Sensor
Service → BD → evaluación de alertas → APIs de dashboard/reportes → Angular.

| Dato mínimo | Evidencia actual | Pendiente del servicio/puente |
|---|---|---|
| sensorId | URL de escritura; DTO de lectura | Mapeo estable por canal físico |
| deviceId | No existe en el contrato de mediciones | Registro/asociación de dispositivo autorizado |
| Tipo | sensorTypeId y catálogo; Alert Service usa readingType | Mapeo explícito entre ambos catálogos |
| Valor | `decimal Value` / `value` | Rangos según sensor físico, no asumir modelos |
| Unidad | Catálogo/DTO del sensor, no cuerpo de lectura | Validar unidad y conversión acordada |
| Fecha UTC | Sensor Service asigna DateTime.UtcNow | Separar captura/recepción para cola offline |
| Comunidad | communityId del sensor | Validación con Community Service e IDs estables |
| messageId | No existe | Idempotencia persistente al recibir reintentos |

Modo compatible actual: POST `/api/sensors/{id}/readings/manual` con
`{"value":25.4}` y GET `/api/sensors/{id}/readings?limit=100`. Conservado.
El modo compartido evalúa/genera alertas en la persistencia compartida.
El modo independiente escribe lecturas, pero no llama al nuevo Alert Service.

El nuevo POST `/api/alerts/evaluate` acepta sensorId, communityId, sensorName,
communityName, readingType y value. Es una API real del compañero; **no la llama
Angular ni la invoca el Gateway como lógica de negocio**. Debe conectarla el
servicio responsable después de persistir la medición. Su prevención de alertas
activas repetidas no garantiza idempotencia de lecturas.

Propuesta a acordar, no endpoint implementado: extender la ingestión sin romper
el cuerpo actual para admitir deviceId, messageId y capturedAt UTC opcionales
con idempotencia transaccional. Resolver tipo/unidad/comunidad desde el sensor
registrado y verificar la identidad del puente. No dar por soportados esos
campos hasta que backend los implemente y pruebe.

El puente conservará credenciales fuera de Angular, reintentará sin duplicar
mediciones y distinguirá valor cero, falta de lectura y pérdida de comunicación.
Calcular frecuencia total frente al límite actual de 120 peticiones/minuto por
IP, incluyendo otras llamadas. La placa, sensores y conectividad exactos siguen
pendientes; no se especifican cableado ni firmware.

## AWS

No se desplegó ni se modificó producción. Antes de cualquier actualización,
identificar por lectura la rama/commit, procesos, imágenes, configuración y
terminación TLS de la instancia existente. Conservar dominio y HTTPS actuales.
El acceso SSH y el inventario siguen pendientes; los valores locales no prueban
que Alert Service esté disponible en AWS.

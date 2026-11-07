# Administración local de usuarios

Ampliación posterior: catálogo de permisos Auth de solo lectura, confirmación de cambios de rol, protección transaccional del último administrador y validación de identidad actual. Ver `COMUNIDADES-ROLES.local.md` para las pruebas recientes y los límites de revocación stateless. Los resultados de abajo corresponden a la validación inicial.

Abrir http://localhost:4200/usuarios con una sesión Administrador. Angular utiliza exclusivamente el Gateway configurado en `environment.apiUrl`; el interceptor existente añade el JWT y gestiona su renovación.

Contratos verificados en Auth Service:

- `GET /api/users`: usuarios con UUID, name, email, roleId, role, isActive, createdAt y updatedAt.
- `GET /api/roles`: UUID, name y description. Los identificadores se cargan del servidor.
- `POST /api/users`: name (1–100), email (hasta 150), password (8–100), roleId UUID.
- `PATCH /api/users/{id}`: name (2–100), email y roleId. No cambia contraseñas.
- `PATCH /api/users/{id}/status`: isActive booleano, previa confirmación en la interfaz.

Auth y Gateway exigen Administrador. No existen contratos de eliminación de usuarios ni creación/edición de roles en esta pantalla. La bitácora simulada fue retirada; la auditoría centralizada se consulta en `/historial` y se documenta en `services/audit-service/README.local.md`.

Validación real local realizada el 2026-11-05 con Chrome automatizado: inicio de sesión administrativo, listado y roles 200; creación 201; edición, desactivación y reactivación 200; persistencia después de recargar y comparación directa en PostgreSQL. Operador recibió 403 en usuarios y roles. Se preservaron íntegramente los usuarios existentes, incluidos sus hashes y roles.

Única cuenta creada: `prueba.usuarios.local@climateguard.test`, UUID `49124823-f752-4d7e-8dfd-1b43888af8ea`, nombre final `PRUEBA LOCAL USUARIOS - EDITADO`, rol Operador. Se dejó desactivada después de las pruebas. La contraseña aleatoria de prueba se utilizó solo en memoria y no se registró.

Regresión HTTP con JWT real: sensores, alertas, comunidades e historial de reportes 200. Navegación autenticada en Chrome a Sensores, Alertas, Reportes y Usuarios verificada; no se repitieron sus operaciones completas. Diseño probado a 390 px sin desbordamiento horizontal de página. Capturas en la carpeta temporal de Windows: `ClimateGuard-users-desktop.png`, `ClimateGuard-users-mobile.png` y `ClimateGuard-users-modal.png`.

Validaciones: Angular 88 pruebas aprobadas y build aprobado; Auth 7 pruebas aprobadas. El build conserva únicamente la advertencia previa de Leaflet CommonJS. Las pruebas unitarias usan respuestas simuladas para errores HTTP; las operaciones de persistencia anteriores utilizaron los servicios y PostgreSQL locales reales.

Las solicitudes tienen un límite de 15 segundos y no se reintentan automáticamente las escrituras. Ante un timeout, actualizar el listado antes de repetir para comprobar si el servidor alcanzó a guardar.

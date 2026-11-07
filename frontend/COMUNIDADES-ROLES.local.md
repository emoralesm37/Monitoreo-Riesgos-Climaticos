# Comunidades, roles y permisos: integración local

Abrir `/comunidades` y `/usuarios` en `http://localhost:4200` con una sesión real de Administrador. Operador puede consultar comunidades y no recibe formularios administrativos. Todas las operaciones de Angular pasan por Gateway.

## Contratos conservados

Comunidades mantiene el destino actual del Gateway al backend compartido local (7000):

| Operación | Contrato | Permiso |
| --- | --- | --- |
| Listar / detalle | GET `/api/communities` y `/{id}` | Sesión autenticada |
| Crear | POST `/api/communities` | Administrador |
| Editar, incluida ubicación opcional | PUT `/api/communities/{id}` | Administrador |
| Activar/desactivar | PATCH `/api/communities/{id}/status`, `{isActive}` | Administrador |

Los IDs son los enteros reales del dominio de comunidades. No existe eliminación en este contrato. La interfaz ofrece cambio de estado con confirmación, sin borrar registros. Búsqueda y filtros de estado/departamento operan sobre los datos recibidos, sin generar consultas adicionales. Los errores mantienen los datos del formulario; no hay cambio optimista de estado. Se conservan rangos geográficos, validación de ambas coordenadas o ninguna y confirmación antes de guardar cambios de ubicación.

El Community Service independiente tiene los mismos métodos principales y autorización, pero su DTO añade fechas y **no incluye sensorCount**. Usa PostgreSQL y no comparte automáticamente las asociaciones de sensores de SQL Server. Se compiló y se ejecutaron sus dos pruebas aisladas, sin iniciarlo ni cambiar el destino actual. Migrarlo requiere acordar el cálculo de sensorCount y las asociaciones por ID con Sensor Service; no se sustituyó ese dato por cero ni se simuló una integración.

## Decisión sobre roles

La [fase 3 oficial](https://github.com/melgust/desaweb2026b/blob/main/phase_3.md), sección 7, y la [fase 4 oficial](https://github.com/melgust/desaweb2026b/blob/main/phase_4.md), secciones 6–8, asignan identidad, roles y permisos a Auth. No prescriben un CRUD dinámico específico de catálogo. El modelo actual tiene dos roles sembrados (`Administrador`, `Operador`), `Role` sin estado, ninguna entidad de permisos editables y autorización mediante decoradores/políticas por nombre de rol.

Se conserva ese modelo: **no hay creación, renombrado, activación, desactivación ni eliminación de roles**. Inventar roles sin políticas asociadas o renombrar Administrador rompería permisos existentes. La gestión consiste en consultar el catálogo y asignar UUID reales a usuarios autorizados.

`GET /api/roles` conserva id/name/description y añade `permissions:[{method,path,label}]`. Es un inventario de las seis rutas administrativas reales de Auth, no un motor editable de permisos ni una matriz global de todos los microservicios. Una prueba lo contrasta con la metadata de los controladores y sus roles requeridos. Angular muestra descripciones legibles; los identificadores/rutas quedan en detalles técnicos. El resto de APIs conserva sus propias políticas.

Los cambios de rol requieren confirmación explícita. Cancelar no envía una modificación. Las operaciones administrativas siguen protegidas en Gateway y Auth. No se toman actor ni permisos del cuerpo de la solicitud.

## Protección del administrador y sesiones

`UsersService` ejecuta las escrituras de usuarios en transacciones PostgreSQL con un advisory lock transaccional compartido entre procesos. Después de obtenerlo vuelve a consultar al actor: debe seguir activo y ser Administrador. Esto evita una comprobación de permisos obsoleta entre el guard y la escritura.

Se rechaza con 409 y código `LAST_ACTIVE_ADMIN` la desactivación o degradación del último administrador activo. No se guarda parcialmente el resto del perfil ni se revocan sus sesiones cuando se rechaza el cambio. Angular reconoce ese código y muestra un mensaje distinto del conflicto de correo duplicado. La protección también funciona cuando las solicitudes concurrentes intentan retirar dos administradores.

Cambiar un rol revoca sus refresh tokens vigentes; desactivar una cuenta también los revoca. `JwtStrategy` de Auth verifica la cuenta y su rol actuales en PostgreSQL y rechaza con 401 un JWT emitido con permisos anteriores o de una cuenta inactiva. No se cambiaron claves ni contraseñas.

**Límite de revocación:** los demás microservicios y Gateway siguen validando JWT de manera stateless. No se ha implementado introspección/lista global de revocación: un access token emitido anteriormente puede conservar acceso allí hasta su expiración. El rechazo inmediato y la revocación de refresh comprobados corresponden a Auth. No se afirma revocación global instantánea.

## Pruebas reales realizadas

- Chrome y Gateway con login administrativo real: crear comunidad 201; editar 204; desactivar/reactivar 204; recargar y consultar confirma persistencia. Cancelar la confirmación no cambió el estado.
- Comunidad nueva **1003**, `PRUEBA LOCAL COMUNIDADES - VALIDACION CRUD - EDITADA`: sin coordenadas inventadas, quedó desactivada. Los tres registros anteriores, incluida la longitud positiva original, permanecieron idénticos.
- JWT real de Operador: POST/PUT/PATCH de comunidades 403; administración de usuarios, roles y consulta de auditoría 403. Chrome muestra listado de comunidades y bloquea las funciones administrativas y la ruta Usuarios.
- Cuenta `prueba.roles.integracion.local@climateguard.test`, UUID `1c82825b-d646-4594-9a3e-394a6ad308c4`: promoción a Administrador desde Angular, persistencia tras recargar y nuevo login real con acceso 200 a roles; posterior regreso a Operador. El JWT administrativo anterior y su refresh devolvieron 401 en Auth. La cuenta quedó desactivada.
- Se conserva también `prueba.roles.local@climateguard.test`, UUID `05152495-5006-499f-bde3-62a89d09ff43`, desactivada. La primera ejecución de validación se interrumpió al intentar interpretar como JSON un 403 sin cuerpo; no fue un fallo del backend. Se completó la prueba con otra cuenta de correo distinta, sin restablecer credenciales. Ambas contraseñas de prueba solo existieron en memoria.
- Auditoría real: se verificaron cinco eventos confirmados de creación/edición/estado de la comunidad y tres de creación/cambio de rol del usuario de integración, antes de la desactivación final. Las acciones finales también pasan por el registrador existente del Gateway. No se fabricaron eventos ni se modificó Audit Service.
- Comparación privada de PostgreSQL: usuarios anteriores idénticos, incluidos hashes y roles; catálogo de roles sin cambios. No se imprimieron hashes ni credenciales.
- Regresión real: Sensores, Alertas activas/resueltas e historial de Reportes 200; Dashboard, Sensores, Alertas y Reportes accesibles en Chrome.

La defensa del último administrador se probó además con el código real de `UsersService` y PostgreSQL en el esquema local nuevo **`cg_admin_guard_46d9de3c74633b09`**, con tablas/usuarios aislados. Se conserva el esquema de prueba, no se borraron datos. Desactivación y degradación del último administrador producen excepción 409; ante pares concurrentes solo una escritura se confirma y queda un administrador. Un Operador no puede autopromoverse (403). No se intentó desactivar ni degradar al administrador existente para demostrarlo.

## Comprobaciones y evidencia

- Angular: 107 pruebas aprobadas; incluye confirmaciones, filtros, errores, reintentos, permisos y catálogo recibido del servidor.
- Auth: 15 pruebas aprobadas; incluye invariantes de administrador, estado/rol actual del JWT y correspondencia del inventario de permisos con controladores.
- Community Service independiente: 2 pruebas aisladas aprobadas y build aprobado. Esto no equivale a haberlo integrado o desplegado.
- Builds Angular y Auth aprobados; persiste la advertencia anterior de Leaflet CommonJS.

```powershell
# Desde frontend
npm.cmd test -- --watch=false
npm.cmd run build
# Desde services/auth-service
npm.cmd test -- --runInBand
npm.cmd run build
# Prueba explícita que crea y conserva un esquema nuevo LOCAL de pruebas:
node test/admin-invariants.local.cjs
# Desde la raíz
dotnet test services/community-service/ClimateGuard.Community.Tests --artifacts-path "$env:TEMP/cg-community-roles-dotnet-tests"
dotnet build services/community-service/ClimateGuard.Community.Api --artifacts-path "$env:TEMP/cg-community-roles-independent-build"
```

Chrome escritorio y móvil 390 px: formularios, tabla, confirmaciones, roles y permisos, recarga y restricciones de Operador. Capturas `%TEMP%/ClimateGuard-communities-desktop.png`, `ClimateGuard-communities-mobile.png`, `ClimateGuard-roles-desktop.png`, `ClimateGuard-roles-mobile.png`.

No se cambió Gateway ni la estructura de tablas de negocio. Se añadieron únicamente los registros de prueba identificados arriba; las tablas nuevas pertenecen al esquema aislado de prueba. No se cambiaron credenciales existentes, ramas ni AWS. La comunidad fuera de Guatemala sigue pendiente de verificación física por su responsable.

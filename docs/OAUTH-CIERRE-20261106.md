# Revisión OAuth/OIDC — 2026-11-06

Se consultó origin/main c26a72d mediante fetch. Integración selectiva del cambio
de Julieta 5e1c69e (sobre a8be7b7), sin merge, commits, push, reset ni stash.
Se preservaron las modificaciones locales; no se abrió ningún archivo .env.
No se accedió a AWS ni se automatizaron cuentas reales.

## Cambios integrados

- JWT access y refresh: role, roles, permissions y provider.
- Proveedor local/google/github conservado en la renovación. Tokens anteriores
  sin provider conservan compatibilidad mediante el valor local.
- El intercambio OAuth toma el proveedor del flujo persistido del servidor.
- Se mantiene la rotación transaccional local, con advisory lock y bloqueo de fila;
  los roles y permisos se regeneran desde el usuario actual.
- Inventario de permissions equivalente al cambio de Julieta. Es informativo:
  la autorización continúa basada en los guards y políticas de cada servicio.
- Pruebas de callbacks adaptadas a OAuthController/OAuthService locales. No se
  incorporaron los callbacks Passport antiguos que devuelven tokens directamente.

## Verificación ejecutada

- Auth: npm.cmd test -- --runInBand: 51 pruebas, 9 suites, todas pasan.
- Auth: npm.cmd run build: pasa.
- Frontend: npm.cmd test -- --watch=false: 112 pruebas, 24 archivos, pasan.
  Incluye login, callbacks, interceptor, Usuarios, Alertas y Auditoría.
- Gateway: dotnet test gateway/tests/ClimateGuard.Gateway.Tests --no-restore
  --verbosity quiet: 44 pruebas pasan; incluye enrutamiento, 401/403 y auditoría.
- Auditoría: pytest en imagen local, red deshabilitada y código montado en solo
  lectura: 10 pruebas pasan. Mongo simulado; no se conectó a la base real.
- Alertas: build Docker hasta target build (mvn clean verify en caché), seguido
  de ejecución nueva docker run --rm --network none ... mvn -o test -q: pasa.
  Los informes del build contienen 14 pruebas (1 contexto, 12 controlador,
  1 límites). Utiliza H2 y no la base de datos del servicio activo.

Los nuevos tests verifican firma/claims, issuer/audience/expiración incorrectos,
rotación secuencial, rechazo de refresh reutilizado, logout, proveedor conservado,
roles actuales, login local válido e inválido, cuentas externas sin contraseña,
Viewer al registrarse, coincidencia de correo que exige vinculación explícita,
vinculación a otra cuenta rechazada, cuenta inactiva, estado/cookie/proveedor,
expiración, cancelación, ticket de un uso y ambos redirects de callbacks.

## Diferencias y pendientes

La integración es funcional y las regresiones automatizadas pasan. No se declara
un cierre integral de extremo a extremo en esta revisión:

1. Falta probar concurrencia y rollback de refresh contra PostgreSQL real o una
   base efímera: los nuevos tests Auth usan repositorios simulados. El bloqueo se
   conserva por revisión, pero esos mocks no demuestran exclusión concurrente.
2. Falta repetir, con intervención del usuario, Google y GitHub desde el navegador
   y verificar la sesión renovada después del despliegue/reinicio local del cambio.
   El login real previo se toma como antecedente del usuario, no como nueva prueba.
3. Usuarios/Alertas/Auditoría se validaron mediante pruebas aisladas y de Gateway;
   no se ejercitó el recorrido completo con bases y procesos locales activos.
4. No se fusionó origin/main completo: los cambios remotos ajenos al cierre OAuth
   permanecen fuera del alcance. Los archivos OAuth locales sin seguimiento siguen
   en ese estado, junto con el resto del trabajo previo.
5. GitHub implementa OAuth con perfil/correo verificado; Google valida identidad
   OIDC firmada y nonce. No se presenta GitHub como proveedor OIDC.

No se leyeron ni imprimieron claves reales, tokens reales ni contraseñas reales.
Las pruebas utilizan claves y perfiles sintéticos. Advertencias no bloqueantes:
VM Modules experimental en Node y deprecación Starlette/httpx en Auditoría.

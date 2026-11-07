# OAuth local integrado

Integracion selectiva de `origin/feature/fase4-auth-oauth` de Julieta
(`a8be7b7da55384326da2b393890cf31d373e6101`), revisada previamente en un worktree aislado.
Se conservaron las modificaciones locales, los roles Administrador/Operador, la revocacion
por cambios administrativos y la proteccion transaccional del ultimo administrador activo.

## Ejecucion habitual

- Angular: http://localhost:4200/login; callback publico `/oauth/callback`; vinculacion `/cuenta`.
- Gateway: http://localhost:5147; Auth: http://localhost:7101.
- Si ya estan escuchando, no iniciar una segunda instancia.
- Gateway, desde la raiz: `dotnet build gateway/ClimateGuard.Gateway/ClimateGuard.Gateway.csproj`,
  despues `node gateway/start-local.cjs`. El launcher lee las claves privadas existentes de Auth
  y auditoria y las transmite por entorno, no por argumentos ni archivos versionados.
- Auth: `npm.cmd run start:dev` desde `services/auth-service`.
- Angular: `npm.cmd start` desde `frontend`.

## Configuracion privada

`services/auth-service/.env` esta excluido de Git. Se conservaron todos sus valores anteriores.
Se agregaron frontend y callbacks locales, y una clave nueva exclusivamente para cifrar los
verificadores PKCE (`OAUTH_SESSION_KEY`). No se cambiaron claves JWT, contrasenas ni credenciales
Google/GitHub. La clave de sesion OAuth debe permanecer estable entre reinicios/replicas.

| Variable | Configuracion |
|---|---|
| OAUTH_FRONTEND_URL | http://localhost:4200 |
| GOOGLE_CALLBACK_URL | http://localhost:5147/api/auth/callback/google |
| GITHUB_CALLBACK_URL | http://localhost:5147/api/auth/callback/github |
| OAUTH_SESSION_KEY | Privada; 32 bytes aleatorios codificados como 64 hexadecimales |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Pendientes de una aplicacion Google registrada |
| GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET | Pendientes de una aplicacion GitHub registrada |

Registrar exactamente los callbacks en cada proveedor. Para HTTPS se reutilizara el dominio
existente, sin recrear dominio/TLS; configurar sus URLs HTTPS antes de habilitar proveedores.
No copiar valores privados a Git, argumentos de procesos, capturas ni logs.
Sin credenciales de un proveedor, su inicio devuelve 503 recuperable y el login local sigue operativo.

## Contratos y seguridad

Todas las llamadas Angular pasan por Gateway. Su ruta `/api/auth/**` elimina `/api` y Auth
protege los endpoints privados. CORS permite credenciales solo para origenes explicitamente autorizados.

| Metodo | Endpoint Gateway | Proteccion |
|---|---|---|
| GET | /api/auth/oauth/status | Solo flags de configuracion |
| POST | /api/auth/oauth/{google,github}/start | Origin exacto, state, cookie HttpOnly y PKCE |
| GET | /api/auth/callback/{google,github} | State de un solo uso y cookie del navegador |
| POST | /api/auth/oauth/exchange | Origin, cookie y ticket de 60 segundos de un solo uso |
| POST | /api/auth/oauth/{google,github}/link | JWT del actor y confirmacion de su contrasena local |

Google valida firma RS256 con JWKS, issuer, audience, expiracion, nonce y correo verificado.
GitHub usa ID estable del proveedor y correo primario verificado. Ambos utilizan state y PKCE S256.
No se vinculan cuentas automaticamente por correo ni se aceptan identificadores de actor del cliente.
Nuevas cuentas externas tienen Viewer y password_hash NULL; no pueden usar el login local.
Viewer consulta monitoreo, sin permisos de administracion, escritura de sensores o resolucion de alertas.
Usuarios, reglas, auditoria y reportes siguen restringidos a Administrador.
La vinculacion explicita conserva el rol; una cuenta exclusivamente externa necesita un futuro flujo
adicional de reautenticacion con proveedor para vincular otro proveedor. No hay endpoint de desvinculacion.

Los JWT/refresh se emiten exclusivamente en Auth y nunca viajan en la URL. El retorno incluye
un ticket opaco en el fragmento, que Angular borra antes de intercambiarlo. La rotacion de refresh
se realiza en una transaccion PostgreSQL con bloqueo; un refresh concurrente solo puede tener un exito.
El intercambio OAuth se clasifica como login en la entrega de auditoria existente del Gateway.
No habilitar logs de cuerpos o query strings de callbacks en proxies/Ingress.

## Migraciones y persistencia

Se aplicaron unicamente las dos migraciones aditivas OAuth sobre PostgreSQL LOCAL tras comprobar
esquema, historial y ausencia de conflictos. Agregan Viewer, external_accounts y oauth_flows,
indices unicos y password_hash nullable. Los siete usuarios y los dos roles existentes permanecieron
identicos, incluidas sus credenciales. No hay synchronize ni migraciones automaticas al arrancar.
Los down destructivos estan bloqueados. Las copias previas de entorno y usuarios estan cifradas
con DPAPI junto al respaldo original; nunca se imprimen sus contenidos.

Los flujos guardan hashes de state/nonce/ticket y verificador PKCE cifrado AES-256-GCM, no tokens
de proveedores. La depuracion con retencion de flujos expirados queda como tarea operativa posterior.

## Validacion y limites

Pruebas afectadas: Angular, Auth y Gateway; comprobacion basica de APIs con JWT real.
La validacion previa de identidad externa/replays utilizo fixtures explicitos y PostgreSQL real aislado;
no constituye login real con Google/GitHub. Las credenciales de las aplicaciones siguen pendientes.
El componente K8s opcional OAuth se recupero sin desplegarlo y Auth permanece con una replica/Recreate.
La opcion `render.py --oauth` usa URLs derivadas del dominio indicado y referencias al Secret
`oauth-clients`; no contiene valores secretos ni configura aplicaciones externas automaticamente.

Referencias oficiales:
- https://developers.google.com/identity/openid-connect/openid-connect
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

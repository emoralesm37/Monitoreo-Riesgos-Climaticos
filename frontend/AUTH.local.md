# Autenticacion local: correccion y validacion

## Causa comprobada

En Chrome, Auth respondia 401 pero el boton seguia deshabilitado y el error no
aparecia. Login mutaba campos desde subscribe sin notificar al render zoneless.
El callback terminaba, pero la vista seguia mostrando el estado anterior.
Tambien faltaban limite de espera, control de duplicados y renovacion de sesion.
Auth /health y Gateway /health respondieron 200; PostgreSQL estaba up.
No se restablecieron contrasenas ni se modificaron usuarios o configuracion JWT.

## Comportamiento implementado

- Estado reactivo idle/loading/success/error; finalize y cancelacion al desmontar.
- Validacion de correo y longitud minima segun DTO de login; se conservan campos
  al fallar. Formulario por teclado, labels, autocomplete, foco visible, live
  regions, aria-busy y mensajes de error especificos sin mostrar detalles internos.
- Timeout de 10 segundos para login/refresh/logout, sin reintento automatico de
  esos POST. Una respuesta tardia no deja bloqueado el formulario.
- Mensajes para 401, 403, 429, 500, 502/503, 504, red y timeout.
- Credenciales y tokens nunca en URL, consola o archivos de prueba.
- Return URL solo local; no se vuelve a /login como destino exitoso.

## Refresh real

Se consume el contrato existente POST /api/auth/refresh con body refreshToken.
Auth valida la sesion persistida en PostgreSQL, revoca el token utilizado y
devuelve el mismo contrato de login con ambos tokens nuevos.

Auth Angular renueva antes del vencimiento y comparte una sola solicitud entre
llamadas concurrentes. El interceptor solo agrega Bearer a las APIs del Gateway,
excluye /auth/* y reenvia una peticion 401 como maximo una vez. Un 403 de negocio
no dispara refresh ni borra la sesion. Un 401 tardio de un token anterior puede
utilizar el token ya renovado, evitando rotaciones innecesarias.

El guard espera la renovacion si el access token local vencio. Un refresh
rechazado/expirado cierra la sesion y redirige al login con aviso. Un fallo
transitorio con access token todavia vigente lo conserva y programa un intento
limitado; si ya vencio, se requiere iniciar sesion de nuevo. No hay bucles de
refresh ni se guarda una respuesta tardia despues de logout; el refresh token
emitido tardia e inutilmente se revoca.

Se conserva sessionStorage existente, sin borrar localStorage de negocio.
La lectura de exp del refresh JWT solo sirve para programacion del cliente:
firma, permisos, revocacion e identidad se verifican siempre en los servicios.
La revocacion remota se detecta al renovar; no se inventa un mecanismo de
introspeccion inmediata para access JWT que el backend no ofrece.

## Comprobaciones

- Reproduccion real anterior: login 401, boton deshabilitado y ningun error visible.
- Despues: contrasena incorrecta real -> 401, mensaje correcto, boton habilitado
  y campos conservados. Tambien se observo un 502 transitorio recuperable; el
  intento siguiente valido funciono. La UI ahora distingue ambos casos.
- Chrome con login normal: un solo POST ante dos envios inmediatos; Dashboard,
  Sensores, Alertas y Reportes accesibles, consultas 200.
- Refresh reactivo real: se invalido solo el access token de la sesion headless
  para provocar un 401 real en Gateway. Auth /refresh devolvio 200 y la peticion
  de historial de reportes se repitio correctamente con 200. Sin JWT sinteticos.
- Guard/refresh real: se adelanto el reloj de expiracion guardado en la sesion
  headless (no se modifico el JWT firmado ni el TTL del servidor). Al recargar,
  Auth renovo con 200 y se mantuvo la ruta protegida.
- Se revoco solo el refresh token de esa sesion headless mediante logout normal.
  Su siguiente renovacion recibio 401, limpio la sesion y volvio al login con
  aviso. No se afectaron las sesiones de otros navegadores ni usuarios.
- Chrome movil: sin desbordamiento horizontal. Capturas en TEMP:
  ClimateGuard-login-error-fixed.png, ClimateGuard-login-session-expired.png,
  ClimateGuard-login-mobile.png.

Las respuestas 403/429/500/503, red y timeout se comprueban con HTTP aislado en
pruebas unitarias, no apagando servicios ni alterando cuentas. Las comprobaciones
exitosas de navegador anteriores utilizaron Auth/Gateway reales, sin mocks de API.
Resultado final: 74 pruebas aprobadas en 21 archivos y build Angular correcto.
Tambien se prueba que una peticion de una sesion anterior no se reenvie usando
una sesion de login nueva, y que respuestas malformadas no creen una sesion.

```powershell
cd frontend
npm.cmd test -- --watch=false
npm.cmd run build
```

No se modifican backend, Gateway, bases, credenciales, AWS ni la integracion de
alertas. Se mantienen las advertencias previas de optimizacion CommonJS/Leaflet.

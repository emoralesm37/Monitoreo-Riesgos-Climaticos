# Chrome «Sitio peligroso»: investigación del 6 de noviembre

## Actualización confirmada por el operador

El propietario verificó garher.lat mediante DNS TXT en Google Search Console. En Problemas de seguridad aparece «No se ha detectado ningún problema». Su Chrome abre normalmente el login y /oauth/callback sin parámetros; la advertencia se presenta únicamente en el retorno real de GitHub. Esto delimita el síntoma al retorno y no a un bloqueo general del dominio, pero no permite identificar qué componente del retorno activa la advertencia ni certificar un falso positivo. La investigación sigue abierta; no se cambian rutas ni se desactivan protecciones. La información de Search Console procede del operador, no de acceso directo de esta sesión.

## Resultado y alcance

El operador reportó la advertencia al volver de GitHub; Google OAuth funciona. No se ha confirmado todavía si su Chrome bloquea la portada, las rutas sin parámetros o únicamente el retorno real. No se atravesó la advertencia ni se desactivó Safe Browsing. No se capturaron URLs OAuth reales, códigos, estado, tokens o cookies. No se leyó ningún .env.

**Hipótesis principal, pendiente de confirmación:** advertencia antiphishing/reputación de Chrome sobre la URL o el contexto del retorno de GitHub, posiblemente falso positivo. No hay evidencia suficiente para atribuirla a una clasificación concreta de Safe Browsing ni para excluir un problema local del perfil. La consulta pública «No hay datos disponibles» no certifica seguridad. No se afirma que la advertencia esté resuelta.

Las comparaciones de hashes y la imagen frontend de abajo corresponden al diagn?stico previo al hotfix del mapa. La imagen final y la aceptaci?n posterior est?n documentadas en INTEGRAL-ACCEPTANCE-20261106.md.

## Evidencias reales

- TLS 1.3 con validación normal de cadena y hostname, certificado Let's Encrypt YE1 para climateguard.garher.lat, vigente del 8 de octubre de 2026 al 6 de enero de 2027. No se usó ignoreHTTPSerrors ni validación relajada.
- GET /, /login y /oauth/callback: HTTP 200, mismo HTML SHA256 fca1f3439536f94826867da40e338c87edcbf7a5eddea53b43f33b78637cedf3. HTML sin scripts externos, iframes o formularios con acción HTTP externa. Esto no constituye auditoría completa de malware ni de todas las respuestas posibles.
- HTML y main-C6OQ4LTZ.js públicos coinciden por SHA256 con los archivos de ambas réplicas de la imagen frontend release-20261106-f0048fcb2ff2. Imagen en ambas réplicas sha256:698fbeb4cd684dd1f95dd1a3ac461e8020f96ca79f7b25f87006618f3a73fe66. No se observó inyección diferente entre el servidor público y los Pods.
- Callbacks sin parámetros de ambos proveedores: HTTP 303 a HTTPS, mismo dominio, ruta /oauth/callback, sin query de destino; el fragmento no se registró. Cache-Control no-store y Referrer-Policy no-referrer presentes en callback. No se observó redirección a terceros.
- Ingress HTTPS public dirige /api a Gateway y / a frontend. Ingress public-http usa redirect-https. Auth, Gateway y ambas réplicas frontend disponibles.
- Logs de Gateway revisados solo en memoria, sin imprimir líneas: agregado de 90 minutos incluye GitHub 11 respuestas 303 y una 400, Google nueve 303 y exchange una 201. Incluye pruebas técnicas, así que no demuestra que el intento real bloqueado haya llegado ni que GitHub haya completado sesión. El 400 aislado no se atribuye al aviso de Chrome.
- Gateway registra Path, no QueryString. No se detectaron code/state como query en las menciones de callback analizadas; no se habilitaron access logs de Traefik ni logging adicional. Auth no mostraba errores conocidos de proveedor/estado/conexión en la ventana analizada. No se añadieron registros sensibles.
- Chrome instalado ejecutado en perfil nuevo y headless, sin flags para desactivar Safe Browsing, phishing ni actualizaciones: portada, /oauth/callback y callbacks vacíos de Google/GitHub terminaron en la aplicación sin intersticial. **No equivale al perfil del operador**: las listas/reputación de un perfil nuevo pueden diferir y no se reprodujo una URL real con query ni consentimiento. No prueba que Chrome permita el retorno real.
- Al repetir inmediatamente el navegador después de las 23 pruebas, el callback vacío de Google respondió 429, sin intersticial: se alcanzó el límite de autenticación del Gateway (20 solicitudes/minuto). La primera comprobación había respondido normalmente. Se detuvieron las pruebas repetidas; no se cambió el límite ni Google OAuth. Este 429 HTTP es distinto de la pantalla roja de Chrome.

## Mejora aplicada, sin atribuirle la causa del bloqueo

Faltaban cabeceras de protección en el frontend. Se aplicó candidate/08-response-headers.yaml y se añadió a Ingress public la referencia climateguard-public-response-security@kubernetescrd. Ahora se verifican por HTTPS:

- Strict-Transport-Security: max-age=86400 (sin includeSubDomains ni preload).
- X-Content-Type-Options: nosniff.
- X-Frame-Options: DENY.
- Referrer-Policy: no-referrer.

No se cambiaron clientes, secretos, scopes, callbacks, lógica ni configuración de Google OAuth. No se añadió CSP restrictiva sin evaluar compatibilidad Angular. Después del cambio, las 23 pruebas de protocolo OAuth pasaron nuevamente. No se crean recursos AWS: solo un Middleware de Traefik en K3s.

La configuración previa de Ingress se conserva en EC2 en /srv/climateguard-demo/evidence/ingress-before-response-headers.json (solo spec/anotaciones). Para rollback restaurar el valor anterior de la anotación router.middlewares; no tocar Secrets ni reinstalar aplicaciones. Para reproducir el endurecimiento tras regenerar candidatos, aplicar el Middleware y conservar su referencia en el Ingress HTTPS; el generador histórico no incorpora todavía este archivo adicional.

## Search Console y corrección segura pendiente

No existe conexión autorizada de Search Console en esta sesión; no se accedió a la cuenta Google del usuario. Se solicitó al propietario revisar **Seguridad y acciones manuales → Problemas de seguridad** para la propiedad del subdominio o garher.lat y compartir solo categoría/rutas sin query. También se solicitó comprobar la portada y /oauth/callback en su Chrome, sin atravesar la advertencia.

Si Search Console informa contenido dañino, investigar las rutas indicadas y eliminar únicamente la causa comprobada antes de solicitar revisión de seguridad. Si las evidencias sostienen un falso positivo, el propietario puede informar una clasificación incorrecta mediante el formulario oficial de Google. No enviar códigos OAuth ni URLs de retorno con parámetros. No cambiar de dominio/ruta para evadir la advertencia ni desactivar protecciones. No garantizar revisión antes de la presentación.

[Formulario oficial para comunicar una clasificación incorrecta](https://safebrowsing.google.com/safebrowsing/report_error/?hl=es).

Fuentes oficiales:

- [Chrome: advertencias sobre sitios inseguros](https://support.google.com/chrome/answer/99020).
- [Search Console: problemas de seguridad](https://support.google.com/webmasters/answer/9044101).
- [Google: sitio marcado como peligroso y desfases de actualización](https://support.google.com/webmasters/answer/6347750).
- [Safe Browsing: canonicalización y variantes de URL, incluidos parámetros](https://developers.google.com/safe-browsing/reference/URLs.and.Hashing).

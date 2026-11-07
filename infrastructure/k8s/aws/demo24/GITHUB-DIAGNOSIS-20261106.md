# GitHub OAuth: diagnóstico de producción

## Corrección verificada posteriormente

El operador ejecutó configure-github-private.py y confirmó que las claves de Google y restantes quedaron intactas. Una nueva consulta real por Gateway confirmó Client ID GITHUB_CLIENT_ID_CONFIGURED_PRIVATELY, endpoint GitHub correcto, callback HTTPS exacto y PKCE S256. Auth Service 1/1 y nodo Ready. La solicitud anónima al proveedor redirige 302 a github.com/login; no demuestra consentimiento ni retorno de una cuenta real. Se repitieron las 23 comprobaciones de protocolo de ambos proveedores: todas pasaron. Ya puede repetirse el login manual de GitHub; su retorno exitoso sigue pendiente. No se imprimieron secretos ni se modificaron recursos AWS.

## Diagnóstico inicial (histórico)

Google funciona según prueba humana confirmada por el operador. No se modificó su configuración.

El POST real por Ingress/Gateway a /api/auth/oauth/github/start devuelve 201. El endpoint generado es https://github.com/login/oauth/authorize. El callback decodificado es exactamente https://climateguard.garher.lat/api/auth/callback/github; no hay doble codificación. PKCE S256 presente.

El Client ID generado coincide con github-client-id del Secret oauth-clients, pero termina en .apps.googleusercontent.com: se introdujo un identificador de Google en la configuración de GitHub. El Deployment referencia correctamente las claves separadas de ambos proveedores, por lo que no se encontró un cruce de referencias en el manifiesto.

Una solicitud anónima sin estado ni cookies a GitHub devuelve 302 /login tanto para el ID configurado como para un control inválido. Ese resultado no valida el registro del cliente ni contradice el 404 observado por el operador autenticado. No se automatizó acceso con cuentas reales.

La corrección requiere el Client ID y su Client Secret correspondientes a la OAuth App registrada en GitHub. No pueden deducirse del servidor. configure-github-private.py está preparado en el staging privado de EC2: solicita entrada oculta, actualiza solo las dos claves GitHub, verifica igualdad de todas las demás claves y reinicia únicamente Auth Service. No ejecutado todavía por faltar el par correcto. Se añadió al configurador general una protección contra IDs Google/PAT en GitHub.

Después de la entrada privada: comprobar Client ID público esperado contra flujo generado, callback/PKCE, rollout/readiness y repetir el protocolo OAuth antes de solicitar otra prueba humana de GitHub. No declarar GitHub corregido hasta esas comprobaciones y el retorno real.

# Secrets privados, sin valores en Git

`required-keys.json` es un contrato de nombres y claves, **no contiene valores ni recursos Secret**. Ningún Secret se genera leyendo `.env` automáticamente ni se copia del servidor. La carpeta `.private/` está ignorada y excluida de los contextos de build; preferir almacenamiento privado fuera del repositorio con permisos exclusivos del operador.

| Secret | Consumidor | Alcance |
| --- | --- | --- |
| jwt/access-key | Gateway, Auth, servicios | Firma access token, misma clave validada durante la migración aprobada |
| jwt/refresh-key | Solo Auth | Clave distinta; no distribuir a otros servicios |
| audit-signing/key | Solo Gateway y Audit | HMAC de eventos, independiente de JWT |
| auth-db-app, alert-db-app | Aplicación propietaria y Job de provisión correspondiente | Usuario/password no superusuario |
| auth-db-admin, alert-db-admin | StatefulSet y Job explícito de provisión | Password del administrador PostgreSQL; nunca se inyecta en la aplicación |
| report-db, audit-db | Cada servicio y Job Mongo | Usuarios existentes o nuevos con readWrite limitado a su base |
| mongo-admin | MongoDB y Job de provisión | Administrador, fuera de Report/Audit |
| sql-admin | SQL Server y Job de esquema vacío | Credencial privilegiada; no entregarla a backend/sensores |
| sql-app/connection-string | Backend compartido y Sensor | Host `sqlserver,1433`, base `ClimateGuard`, login limitado al dominio compartido; verificar TLS y permisos privadamente |
| bootstrap-admin | Solo Job Auth de alta inicial | No se usa en Deployments, no restaura ni cambia contraseñas existentes |
| climateguard-tls | Ingress | Certificado/cadena y clave **ya autorizados** del dominio; nombre parametrizable |
| community-db, community-db-admin | Solo componente opcional independiente | No necesarios para el perfil compatible |

Issuer y audience no son secretos y se declaran en ConfigMap runtime. Verificarlos contra el Auth que se vaya a migrar; sus valores locales no prueban los de AWS. Todos los nombres de DB, hosts y credenciales deben revisarse antes de inicializar cualquier recurso. Un Secret con una cadena que apunta a producción no es seguro porque el Pod esté en otro namespace.

## Creación posterior, con autorización y contexto explícito

No se ejecutaron los comandos siguientes. Primero revisar el contexto/namespace de destino y preparar los archivos de valores mediante un mecanismo privado. No usar `--from-literal=password=...`, pegar claves en comandos, `kubectl get secret -o yaml`, `docker inspect` completo ni logs de configuración. Los valores no deben aparecer en historial ni argumentos de procesos.

Ejemplo para un Secret nuevo a partir de archivos privados, nunca del directorio versionado:

Preparar cada valor con entrada oculta, sin BOM ni salto de línea extra (no ejecutar sobre un archivo existente):

```powershell
$archivoPrivado = Join-Path $rutaPrivada 'access-key'
if (Test-Path -LiteralPath $archivoPrivado) { throw 'El archivo ya existe; no se sobrescribe.' }
$valorPrivado = Read-Host 'Valor existente autorizado' -AsSecureString
$punteroPrivado = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($valorPrivado)
try {
  [IO.File]::WriteAllText($archivoPrivado, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($punteroPrivado), [Text.UTF8Encoding]::new($false))
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($punteroPrivado)
  Remove-Variable valorPrivado,punteroPrivado -ErrorAction SilentlyContinue
}
```

La carpeta debe tener permisos privados antes de escribir. No imprimir el archivo ni transformar/recortar una contraseña existente. Los certificados PEM se conservan como archivos completos, sin usar este procedimiento de una sola línea.

```powershell
kubectl --context $contextoVerificado -n climateguard create secret generic jwt --from-file="access-key=$rutaPrivada/access-key" --from-file="refresh-key=$rutaPrivada/refresh-key"
kubectl --context $contextoVerificado -n climateguard create secret tls $nombreTlsVerificado --cert="$rutaPrivada/tls.crt" --key="$rutaPrivada/tls.key"
```

Repetir con las claves exactas de `required-keys.json`. Estos comandos imprimen el nombre, no valores. No sirven como rotación automática: si existe el Secret, revisar su propietario y compatibilidad, sin reemplazar credenciales de bases existentes. No convertir esta lista en un archivo YAML con valores reales. Respaldos de Secrets también requieren protección privada.

La provisión preparada crea usuarios/bases únicamente cuando faltan, verifica la conexión y no cambia passwords existentes. Si el Secret no coincide con un usuario restaurado, el Job falla y requiere revisión; no intenta «arreglarlo» rotando credenciales. Los scripts no imprimen errores que puedan incluir cadenas de conexión. El Job PostgreSQL desactiva logging de sentencias en su sesión antes de DDL de credenciales; revisar auditoría/configuración del servidor antes de usarlo fuera de las bases nuevas de este perfil.

Los Secrets no equivalen a cifrado por estar en base64. Verificar cifrado en reposo de K3s/datastore, RBAC mínimo, acceso de operadores y política de auditoría que no registre sus cuerpos antes del despliegue real. Los Pods de aplicación no montan tokens de ServiceAccount y no necesitan leer el API de Kubernetes. [Modelo de Secrets de Kubernetes](https://kubernetes.io/docs/concepts/configuration/secret/).

El componente opcional `components/oauth` ya implementa las referencias de OAuth
revisadas con el código actual. `render.py --oauth` configura URLs HTTPS del
dominio elegido y añade salida HTTPS para Auth. Requiere el Secret `oauth-clients`
con las cinco claves declaradas en `required-keys.json`, incluida `session-key`
(64 caracteres hexadecimales). No se crearon valores ni se leyeron clientes reales.
Registrar los callbacks exactos en Google/GitHub antes de activar ese componente.
El perfil sin `--oauth` conserva login local y no habilita salida HTTPS pública.

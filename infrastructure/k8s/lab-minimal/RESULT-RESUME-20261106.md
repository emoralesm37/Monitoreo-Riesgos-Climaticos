# Reintento real aislado — 6 de noviembre de 2026

Resultado: **K3s arrancó realmente, pero la prueba mínima quedó interrumpida por presión de RAM del host. No está completada.** El clúster `cg-isolated-mini` quedó detenido, sin eliminar su contenedor ni su volumen. No se desplegaron aplicaciones ni bases de ClimateGuard.

## Recursos medidos y decisión

Windows: 14021 MiB totales; primera medición 3271 MiB disponibles, 2474 MiB inmediatamente antes de crear el clúster. Docker/WSL: 6778 MiB totales, 5994 MiB disponibles inicialmente y 5853 MiB antes del arranque. 16 CPU lógicas y unos 297 GiB libres en C:. Ningún contenedor existente estaba activo.

El preflight pasó sus márgenes operativos de Windows 2048 MiB y Linux 4096 MiB. K3s documenta una base de servidor de 2 CPU y 2 GB, sin incluir las aplicaciones: https://docs.k3s.io/installation/requirements . El perfil añade 224 MiB de requests y hasta 480 MiB de límites. Pasar el preflight no garantiza el margen durante la importación de imágenes y las descargas del sistema.

Durante el arranque Windows bajó a 2160 MiB; durante la importación a 823 MiB y después a 648 MiB. Se detuvo exclusivamente el clúster nuevo. El nodo consumió entre 236.7 y 519.6 MiB según las muestras Docker; última muestra activa 497.9 MiB, CPU 19.97%, con pico observado de CPU 144.44%. Estas muestras no incluyen toda la memoria de WSL, cachés, importación o procesos Windows. No atribuir toda la caída del host al proceso K3s. Tras detenerlo la primera lectura fue 682 MiB: WSL no devolvió inmediatamente toda su memoria al host.

## Ejecución y evidencia

- k3d v5.9.0 instalado portátil en `%TEMP%/ClimateGuard-k3d-tools/k3d.exe`; SHA256 comprobado contra checksums de su release oficial: `49d0b9c796f5b8ba6f58a1dd5469e8b7b34bf9b6ce9078633eedb2789680a034`. La primera comprobación no encontró la línea porque el archivo usa prefijo `_dist/`; corregido el selector, el hash coincidió antes de ejecutar.
- K3s `v1.37.2+k3s1`, imagen fijada por digest `rancher/k3s@sha256:21ea6e0fac4e3930c2ce8aa40ddd41a8b18cb3e9a0222c030dc005e7e88c4332`.
- Un servidor, cero agentes y sin balanceador, límite de 3 GiB. API únicamente `127.0.0.1:6550`; cifrado de Secrets activado. Traefik, ServiceLB, Metrics Server y local-storage deshabilitados. Kubeconfig nuevo en carpeta privada con ACL del usuario; no se modificó el contexto predeterminado.
- `kubectl wait ... Ready` pasó. Consultas reales al API devolvieron un nodo Ready, control plane, containerd 2.3.7-k3s1.
- Se importaron las tres imágenes locales frontend, Gateway y Auth `review-20261106`. Auth se preparó solo para el Job diagnóstico, no para iniciar un servidor.
- Captura final: Deployment CoreDNS 1 disponible, Pod CoreDNS Running y Ready; Job automático de instalación Gateway API CRD Succeeded. Services `kubernetes` y `kube-dns` presentes.
- Eventos de arranque: `InvalidDiskCapacity` inicial y una readiness de CoreDNS con conexión rechazada antes de quedar disponible. No se observó OOMKilled. El contenedor terminó con código 137 al detener el clúster; Docker informa `OOMKilled=false`.
- No se aplicaron platform/apps/probe del laboratorio; namespace de aplicación, Secrets de prueba, Deployments frontend/Gateway y Job HTTP no fueron creados. **DNS desde un Pod y HTTP de aplicaciones: NO EJECUTADOS.** CoreDNS Ready no demuestra resolución funcional desde las aplicaciones.
- Cinco pruebas unitarias del gate pasaron; render del perfil pasó. No se presenta ese resultado como validación real HTTP.

Evidencia pública sin claves: `preflight-resume.json`, `consumption-resume.jsonl`, `nodes-resume.json`, `resources-resume.json` y `events-resume.json`. El preflight anterior se conservó también en la carpeta temporal de herramientas. Respaldo del directorio antes de los cambios documentales: `../ClimateGuard-backups/lab-resume-20261106-115539` respecto a la raíz del repositorio.

## Protección y alternativa

Los nueve contenedores previos conservaron sus identidades y estados detenidos. No se iniciaron bases, no se montaron datos existentes ni archivos dotenv, no se crearon credenciales de aplicación, no se tocó AWS ni se ejecutaron commits/push/reset. k3d usa y retira automáticamente su contenedor auxiliar y tar de importación; no se borraron contenedores ni volúmenes existentes de ClimateGuard. El nodo y volumen nuevos del laboratorio se conservan detenidos.

Alternativa: ejecutar este perfil sin bases en una VM Linux separada con 4 vCPU, 6 GiB RAM y 20 GiB libres. Para reintentar aquí, liberar margen adicional del host (propuesta operativa: al menos 4 GiB Windows disponibles antes de arrancar/importar), medir de nuevo Windows y WSL, y arrancar únicamente este clúster con su kubeconfig privado. No reiniciar bases ni WSL de forma automática. Volver a comprobar readiness del sistema, aplicar las tres etapas documentadas y ejecutar el Job DNS/HTTP antes de considerar aprobada la prueba mínima. No hace falta recrear ni eliminar el clúster conservado.

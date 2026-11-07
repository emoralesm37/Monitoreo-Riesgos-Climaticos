# Publicacion de ClimateGuard - 6 de noviembre de 2026

Se publica el trabajo local terminado mediante una rama y PR en borrador. La carpeta original, los commits previos y los cambios del equipo permanecen conservados. Main no se sobrescribe.

## Pruebas ejecutadas para publicar

- Angular: 116 tests y build de produccion correctos.
- Auth: 53 tests y build correctos.
- Gateway: 58 tests; Community: 2; Sensor: 28; contratos backend/reportes: 4.
- Report mappers Python: 4; seguridad de manifiestos K3s: 15; perfil demo24: 11.

Total: 291 comprobaciones aprobadas. Las pruebas de manifiestos son offline y no acreditan un despliegue nuevo. Gitleaks v8.30.1 reviso archivos publicables e historial nuevo sin hallazgos; los informes completos quedan privados. Las plantillas de entorno omiten valores secretos.

No se repitieron tests Java por falta de Java/Maven, ni las suites completas Python con dependencias nativas Linux. Existen advertencias previas de paquetes NuGet PKCS y presupuestos CSS/CommonJS de Angular; no impidieron builds, pero requieren mantenimiento. No se afirma una auditoria completa de dependencias.

## Evidencias anteriores, no repetidas ahora

La version local habia sido validada en AWS K3s con 58 comprobaciones HTTP originales, 44 Chrome originales, 54 Chrome ampliadas, 75 de integracion y 15 de Operador. Los ocho tipos PDF fueron generados y descargados; Community usa una base y cuenta PostgreSQL separadas; la ingestion autentica propietario/dispositivo, persiste y deduplica. Report Service tuvo 52 tests Python y Audit 11 en Linux. Esas pruebas no se repitieron durante esta publicacion. Capturas, PDF, logs, cuentas y estados privados no se publican.

## Integracion pendiente

Consultar [MAIN-INTEGRATION-REVIEW.md](MAIN-INTEGRATION-REVIEW.md): hay 44 archivos con conflictos respecto de main. Resolver los contratos y migraciones de ambas partes en una rama de revision, sin aceptar masivamente ours/theirs ni usar reset/force push. Repetir pruebas despues de resolverlos; las pruebas actuales no validan esa combinacion pendiente. El PR permanece en borrador y main no se fusiona automaticamente.

## Limites

El retorno real de GitHub OAuth sigue pendiente por la advertencia de Chrome. No se desactivaron protecciones. Google permanece sin cambios. Falta conectar, calibrar y validar fisicamente Arduino. Ocho tipos PDF disponibles no certifican por si solos todos los campos de la rubrica.

Los scripts operativos usan marcadores para identificadores e IP; configurarlos privadamente y revisar candidatos historicos antes de ejecutarlos. No se publican secretos Kubernetes, kubeconfig, tokens, claves privadas, respaldos ni credenciales reales. No se modificaron AWS ni el plan FREE.

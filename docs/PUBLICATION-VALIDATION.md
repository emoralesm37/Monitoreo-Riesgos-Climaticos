# Publicaci?n de ClimateGuard ? 6 de noviembre de 2026

Esta rama contiene el c?digo local terminado, agrupado en commits. La carpeta de trabajo original y sus cambios pendientes se conservaron. Se integra mediante Pull Request; main no se sobrescribe.

## Validaci?n repetida en esta rama

- Angular: 116 tests pasan y build de producci?n correcto.
- Auth: 53 tests pasan y build correcto.
- Gateway: 58 tests pasan.
- Community: 2 tests pasan.
- Sensor: 28 tests pasan.
- Contratos backend/reportes: 4 tests pasan.

En total, 261 tests de aplicaci?n repetidos. Los tests no automatizaron cuentas personales ni cambiaron AWS. El an?lisis de secretos usa Gitleaks con resultados redactados y revisi?n de nombres/configuraci?n. Las plantillas de entorno no contienen valores privados.

## Evidencia previa a esta publicaci?n

La versi?n local se valid? previamente en K3s mediante 58 comprobaciones HTTP originales, 44 Chrome originales, 54 Chrome ampliadas, 75 comprobaciones de integraci?n y 15 de Operador. Los ocho tipos PDF fueron generados/descargados; Community usa su base PostgreSQL y cuenta separadas; la ingesti?n autentica dispositivo/propietario, persiste y deduplica. No se conect? Arduino. Esas pruebas AWS no se repitieron durante la publicaci?n. Las capturas, PDF, logs, datos de cuentas y estados de ejecuci?n se conservaron privadamente y no se publican.

Report Service tuvo 52 tests Python y Audit Service 11 aprobados en la validaci?n Linux anterior. Esta nota diferencia evidencia previa de ejecuciones nuevas; no afirma que los tests del snapshot local validen la combinaci?n pendiente con main.

## Integraci?n del equipo pendiente

La comparaci?n con origin/main encontr? conflictos sem?nticos en Auth/OAuth, Auditor?a, Community/migraciones, Alertas y Report Service. El PR se deja como borrador para revisi?n; no se eligi? una versi?n completa por encima de la otra ni se modific? main. Los commits locales previos y la tentativa aislada de integraci?n se conservan localmente.

Para integrar: crear una rama de revisi?n desde origin/main, fusionar esta rama sin force/reset, resolver cada conflicto conservando los contratos y migraciones de ambas partes, repetir los tests, y subir el commit de resoluci?n al PR mediante push normal. No ejecutar procedimientos de despliegue sobre AWS durante esa revisi?n.

## L?mites conocidos

El retorno real de GitHub OAuth sigue bloqueado por una advertencia de Chrome; no se ha desactivado Safe Browsing ni se afirma que est? resuelto. Google permanece sin cambios. Faltan conexi?n, calibraci?n y validaci?n f?sica del Arduino. La disponibilidad de ocho tipos PDF no certifica por s? sola cada campo o condici?n de la r?brica completa.

Los scripts operativos y ejemplos usan marcadores para identificadores de instancia, snapshot e IP. Deben configurarse privadamente; no ejecutar plantillas o candidatos hist?ricos sin revisi?n. No se publican secretos Kubernetes, kubeconfig, tokens, claves privadas, respaldos ni credenciales reales.

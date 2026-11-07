# Mapa de monitoreo

Componente standalone con Leaflet cargado dinamicamente solo en navegador.
Reutiliza la misma consulta de ComunidadesService que alimenta el contador del
Dashboard: GET al Gateway /api/communities, con el interceptor JWT existente.
No consulta directamente bases ni servicios backend.

La API actual ya expone latitude/longitude opcionales, isActive y sensorCount.
Validacion local: dos comunidades reales, cero pares validos de coordenadas y
dos registros sin ubicacion. No se insertaron ubicaciones ni se geocodificaron
nombres automaticamente. El centro de Guatemala es solo una vista geografica
inicial, nunca un marcador sustitutivo de comunidad.

Un par valido exige numeros finitos dentro de rangos geograficos; cero es valido.
Marcadores cian neutrales, sin inferencia de riesgo. El popup distingue estado
administrativo de riesgo; tanto popup como tooltip utilizan nodos con textContent.
El numero de sensores asociados no implica sensores geolocalizados.

Los sensores actuales no tienen coordenadas propias en su DTO. No hace falta
una migracion para comunidades: pueden registrarse coordenadas verificadas con
su contrato existente. Para una futura capa de sensores se debe acordar primero
si se mostrara la ubicacion de la comunidad como referencia o una posicion
propia del dispositivo; en el segundo caso se necesitara ampliar contrato y
persistencia. Para riesgo se requiere una fuente real y una regla de agregacion
por comunidad antes de utilizar colores verde/amarillo/rojo.

Se destruye el mapa, se desconecta ResizeObserver y se cancela el frame pendiente
al desmontar. Estados separados para carga/API fallida/sin coordenadas y error
de teselas. ResizeObserver y requestAnimationFrame actualizan el tamano visible.

Mapa base OSM estandar mediante HTTPS, sin claves, precarga masiva ni modo offline.
Solo la capa de teselas tiene un filtro visual frio; no afecta a la atribucion,
los controles ni los marcadores. Atribucion visible y conservada segun:
https://operations.osmfoundation.org/policies/tiles/

Pruebas unitarias usan Leaflet simulado y coordenadas de fixtures, no datos
productivos. Comprueban validacion, XSS, estado/cero, reintento, SSR y limpieza.
Validacion real en Chrome con login normal: teselas OSM cargadas, atribucion
visible, cero marcadores con las dos comunidades actuales, movil 390px sin
desbordamiento y navegacion de ida/vuelta sin reinicializacion duplicada.

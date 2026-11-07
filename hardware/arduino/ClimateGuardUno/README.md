# Arduino Uno R3: HC-SR04 y DHT11

Abrir `ClimateGuardUno.ino` en Arduino IDE. Este firmware mide y entrega JSON por
USB; no envia por si solo datos a AWS. No contiene credenciales. Se cargo y
verifico con sensores fisicos mediante el puente descrito en ../../bridge/README.md.

Compilacion verificada con arduino:avr:uno, core AVR 1.8.8, DHT 1.4.7 y
Adafruit Unified Sensor 1.1.15: version calibrada 6342 bytes de programa (19%) y 219 bytes de RAM
global (10%). El core AVR emite advertencias de parametros no usados en new.cpp;
no hubo errores de compilacion ni advertencias del sketch. Las bibliotecas ya
quedaron instaladas en el equipo de desarrollo.

## Cableado (con Arduino desconectado)

| Sensor | Pin del sensor | Arduino Uno R3 |
|---|---|---|
| HC-SR04 | VCC | 5V |
| HC-SR04 | GND | GND |
| HC-SR04 | TRIG | D9 |
| HC-SR04 | ECHO | D8 |
| DHT11 | VCC / + | 5V |
| DHT11 | GND / - | GND |
| DHT11 | DATA / S | D2 |

Todos comparten GND. Guiarse por las etiquetas del modulo: el orden de los pines
de los modulos DHT11 de tres terminales puede variar. En el DHT11 desnudo de cuatro
pines, visto de frente con rejilla hacia ti y terminales abajo: 1 VCC, 2 DATA,
3 sin conectar, 4 GND. Usar resistencia de 10 kohm entre DATA y 5V si no esta
incorporada al modulo. Este cableado es para Uno R3 de logica 5V; no extrapolar
ECHO directamente a placas de 3.3V. No mojar el HC-SR04 ni el DHT11.

## Carga y prueba

1. Instalar en el gestor de bibliotecas **DHT sensor library by Adafruit** y su
   dependencia **Adafruit Unified Sensor**.
2. Seleccionar placa **Arduino Uno** y el puerto COM real.
3. Verificar/compilar; cargar solo cuando el cableado este revisado.
4. Abrir Monitor Serie a **115200 baudios**. Tras el arranque hay una linea JSON
   cada cinco segundos. Cerrar el monitor antes de abrir un puente serial.
5. Comprobar distancia con una regla y temperatura/humedad con una referencia.
   Un dato ausente se imprime como `null`; no convertirlo en cero ni enviarlo.

## Calibracion del nivel

El HC-SR04 mira verticalmente hacia abajo. Medir desde su cara hasta la referencia
elegida como nivel cero. Poner esa distancia real en centimetros en
`ZERO_WATER_DISTANCE_CM`. Actualmente vale 30.0 cm, medida proporcionada por el
operador del montaje; volver a medir si cambia la posicion. El nivel se calcula:

`water_level_m = (distancia_referencia_cm - distancia_superficie_cm) / 100`

El firmware conserva la distancia cruda y solo calcula nivel con calibracion
valida. Una distancia mayor a la referencia da nivel `null`, no un cero inventado.
Distancias menores a 2 cm, falta de eco o menos de dos ecos validos entre tres
intentos dan `null`. Verificar la zona muerta y el montaje real; espuma, inclinacion
y condensacion alteran el eco. No asumir que esto equivale a caudal o lluvia.

## Integracion con ClimateGuard

Un Uno R3 sin modulo de red necesita un equipo con USB e Internet como puente.
El JSON serial es un protocolo local, **no** el cuerpo HTTP de ingestion.
El [puente](../../bridge/README.md) ya esta preparado. Se verificaron lecturas
fisicas persistidas por HTTPS y visibles en el dashboard. El HC-SR04 presento
ecos intermitentes: requiere revisar montaje; los fallos no se sustituyen por cero.

Registrar tres sensores logicos: Temperatura (`C`), Humedad (`%`) y NivelRio (`m`),
con sus IDs reales y dispositivos vinculados a una cuenta Operador. La API vincula
cada deviceId a un unico sensor: usar un deviceId diferente por canal. Enviar cada
valor no nulo a `POST /api/sensors/{sensorId}/readings/ingest` mediante Gateway con
Bearer y los campos deviceId, measurementId, value, capturedAt y unit.
No enviar distance_cm como NivelRio ni temperatura, humedad y nivel como una sola
lectura. La unidad debe coincidir exactamente con el catalogo.

El puente asigna UUID de medicion y fecha UTC al recibir cada captura, guarda el
sobre antes del primer envio y reutiliza el mismo contenido e ID en reintentos.
sequence y uptime_ms son diagnosticos del Arduino, no identificadores globales ni
hora UTC; se reinician al arrancar y millis desborda. Documentar la hora como
recepcion en el puente. No conservar credenciales en el .ino ni imprimir tokens.

Contrato completo: [ARDUINO-INGESTION.md](../../../infrastructure/k8s/aws/demo24/ARDUINO-INGESTION.md).

Referencias: [Uno R3](https://store.arduino.cc/products/arduino-uno-rev3),
[DHT y cableado](https://learn.adafruit.com/dht/connecting-to-a-dhtxx-sensor),
[ultrasonidos](https://learn.adafruit.com/ultrasonic-sonar-distance-sensors).

# ClimateGuard - Agente multisensor Python

## 1. Descripción

Agente Python para recopilar mediciones ambientales mediante
simulación o comunicación serial con Arduino Uno.

El agente permite procesar los siguientes tipos de sensores:

- TEMPERATURE: temperatura (°C)
- HUMIDITY: humedad (%)
- RAINFALL: precipitación (mm)
- WATER_LEVEL: nivel de agua (m)
- WIND_SPEED: velocidad del viento (km/h)

## 2. Arquitectura

Arduino Uno / Simulador
        |
        v
Agente Python
        |
        v
YARP Gateway
        |
        v
Sensor Service (.NET)
        |
        v
SQL Server

La autenticación se realiza mediante Auth Service (JWT).

## 3. Requisitos

- Python 3.10 o superior.
- Biblioteca pyserial.
- WSL Ubuntu o Linux.
- Gateway y microservicios ClimateGuard disponibles.
- Arduino Uno para el modo serial físico.

## 4. Instalación

Desde la raíz del repositorio:

    python3 -m venv services/arduino-agent/.venv

    services/arduino-agent/.venv/bin/python -m pip install pyserial

## 5. Configuración

Consultar el archivo .env.example.

Variables principales:

    ARDUINO_AGENT_MODE=simulation
    ARDUINO_SEND_ENABLED=true
    ARDUINO_SIMULATION_INTERVAL=10

Modos disponibles:

- simulation: genera mediciones simuladas.
- serial: recibe mediciones mediante puerto USB.

El envío a Gateway está habilitado por defecto.

El archivo .env.example es una plantilla y no se carga
automáticamente.

## 6. Ejecutar en modo simulación

    ARDUINO_AGENT_MODE=simulation ARDUINO_SEND_ENABLED=false \
    services/arduino-agent/.venv/bin/python services/arduino-agent/agent.py

Detener con Ctrl+C.

## 7. Autenticación

Para habilitar el envío, configurar previamente:

    CLIMATEGUARD_AGENT_EMAIL
    CLIMATEGUARD_AGENT_PASSWORD

No almacenar contraseñas reales en el repositorio.

El agente obtiene tokens JWT desde Auth Service.

## 8. Envío de mediciones

Para habilitar el envío en modo simulación:

    ARDUINO_AGENT_MODE=simulation ARDUINO_SEND_ENABLED=true \
    services/arduino-agent/.venv/bin/python services/arduino-agent/agent.py

Este comando genera y envía mediciones periódicamente.

Solo se envían mediciones de sensores configurados y
confirmados como activos mediante Gateway.

Cada envío exitoso genera un registro en SQL Server.

## 9. Comunicación con Arduino Uno

Formato JSON esperado por línea:

    {"sensorType":"TEMPERATURE","value":26.5}

Configuración predeterminada:

    ARDUINO_SERIAL_PORT=/dev/ttyACM0
    ARDUINO_SERIAL_BAUDRATE=9600

Para iniciar el modo serial:

    ARDUINO_AGENT_MODE=serial ARDUINO_SEND_ENABLED=false \
    services/arduino-agent/.venv/bin/python services/arduino-agent/agent.py

El puerto debe corresponder al Arduino conectado.

No utilizar puertos de otros dispositivos USB.

## 10. Componentes

- agent.py: punto de entrada.
- config.py: configuración general.
- sensors.py: definiciones de sensores.
- simulator.py: generación de mediciones.
- runner.py: ejecución periódica.
- auth_client.py: autenticación JWT.
- token_manager.py: administración de tokens.
- gateway_client.py: comunicación HTTP.
- sensor_registry.py: consulta de sensores activos.
- serial_reader.py: lectura serial.
- serial_gateway.py: asociación de sensores.
- serial_processor.py: procesamiento de mediciones.
- serial_runner.py: ejecución serial continua.

## 11. Estado actual

Validado:

- Simulación multisensor.
- Autenticación JWT.
- Envío HTTP 201 mediante Gateway.
- Almacenamiento de mediciones en SQL Server.
- Consulta de sensores activos.
- Procesamiento de mensajes seriales simulados.
- Selección de modos simulation y serial.

Pendiente:

- Pruebas con Arduino Uno físico.
- Implementación del programa Arduino.
- Validación de sensores físicos y calibración.
- Pruebas de reconexión serial.
- Pruebas prolongadas de renovación JWT.
- Definición de rangos adecuados para mediciones reales.

Los rangos actuales de sensors.py son valores de prueba
y no deben utilizarse como límites de seguridad ambiental.

"""Configuración del agente de sensores físicos ClimateGuard."""

import os

# Modo de funcionamiento: simulation o serial
AGENT_MODE = os.getenv("ARDUINO_AGENT_MODE", "simulation").lower()

# Dirección del Gateway
GATEWAY_URL = os.getenv(
    "CLIMATEGUARD_GATEWAY_URL",
    "http://localhost:5147"
).rstrip("/")

# Dirección del servicio de autenticación
AUTH_URL = os.getenv(
    "CLIMATEGUARD_AUTH_URL",
    "http://localhost:7101"
).rstrip("/")

# Identificador del sensor registrado en SQL Server
SENSOR_ID = int(os.getenv("ARDUINO_SENSOR_ID", "1"))

# Intervalo entre mediciones simuladas, en segundos
SIMULATION_INTERVAL = float(
    os.getenv("ARDUINO_SIMULATION_INTERVAL", "10")
)

# Configuración serial para Arduino Uno
SERIAL_PORT = os.getenv("ARDUINO_SERIAL_PORT", "/dev/ttyACM0")
SERIAL_BAUDRATE = int(os.getenv("ARDUINO_SERIAL_BAUDRATE", "9600"))

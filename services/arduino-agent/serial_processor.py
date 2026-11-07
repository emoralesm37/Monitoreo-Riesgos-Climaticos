"""Procesamiento de mediciones seriales para ClimateGuard."""

import os

from gateway_client import send_reading
from serial_gateway import resolve_sensor


def process_reading(reading, active_sensors, access_token=None):
    """Valida una medición y opcionalmente la envía a Gateway."""

    resolved = resolve_sensor(reading, active_sensors)

    if resolved is None:
        return {
            "success": False,
            "status": "DISCARDED",
            "reason": "Sensor no configurado, inactivo o valor inválido.",
        }

    send_enabled = (
        os.getenv("ARDUINO_SEND_ENABLED", "true").lower() == "true"
    )

    if not send_enabled:
        return {
            "success": True,
            "status": "SIMULATED",
            "sensor_id": resolved["sensor_id"],
            "sensor_type": resolved["sensor_type"],
            "value": resolved["value"],
        }

    if not access_token:
        return {
            "success": False,
            "status": "AUTH_REQUIRED",
            "reason": "Se requiere autenticación JWT.",
        }

    return send_reading(
        resolved["sensor_id"],
        resolved["value"],
        access_token,
    )

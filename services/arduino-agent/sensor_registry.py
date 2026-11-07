"""Consulta de sensores registrados en ClimateGuard."""

import json
import urllib.request

from config import GATEWAY_URL


def get_active_sensors(access_token):
    """Obtiene los sensores activos registrados en Sensor Service."""

    request = urllib.request.Request(
        f"{GATEWAY_URL}/api/physical-sensors",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=10) as response:
        sensors = json.load(response)

    if not isinstance(sensors, list):
        raise ValueError(
            "Gateway devolvió un catálogo de sensores inválido."
        )

    active_sensors = {}

    for sensor in sensors:
        if not sensor.get("isActive"):
            continue

        sensor_type = sensor.get("sensorType")
        sensor_id = sensor.get("sensorId")

        if sensor_type and isinstance(sensor_id, int) and sensor_id > 0:
            active_sensors.setdefault(sensor_type, []).append(sensor_id)

    return active_sensors

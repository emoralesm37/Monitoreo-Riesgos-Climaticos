"""Integración de mediciones seriales con sensores ClimateGuard."""

from sensors import SENSORS


def resolve_sensor(reading, active_sensors):
    """Identifica una instancia activa para una medición serial."""

    sensor_type = reading.get("sensor_type")
    value = reading.get("value")

    if not isinstance(sensor_type, str):
        return None

    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
    ):
        return None

    for sensor in SENSORS:
        if not sensor.enabled:
            continue

        if sensor.sensor_type != sensor_type:
            continue

        if sensor.sensor_id is None:
            return None

        if sensor.sensor_id not in active_sensors.get(sensor_type, []):
            return None

        if not sensor.min_value <= value <= sensor.max_value:
            return None

        return {
            "sensor_id": sensor.sensor_id,
            "sensor_type": sensor_type,
            "value": float(value),
            "unit": sensor.unit,
        }

    return None

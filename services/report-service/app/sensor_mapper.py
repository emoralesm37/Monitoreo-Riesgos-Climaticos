
def map_sensor(sensor: dict) -> dict:
    last_value = sensor.get("lastValue")
    last_updated_at = sensor.get("lastUpdatedAt")

    status = (
        "Activo" if sensor.get("isActive") is True
        else "Inactivo" if sensor.get("isActive") is False
        else "No disponible"
    )

    return {
        "sensor_id": sensor.get("sensorId"),
        "name": sensor.get("name") or "Sin nombre",
        "sensor_type": sensor.get("sensorType") or "No disponible",
        "community_id": sensor.get("communityId"),
        "status": status,
        "last_value": (
            last_value if last_value is not None
            else "Sin lecturas"
        ),
        "last_updated_at": (
            last_updated_at if last_updated_at is not None
            else "No disponible"
        ),
        "created_at": sensor.get("createdAt") or "No disponible",
    }


def map_sensors(sensors: list[dict]) -> list[dict]:
    return [map_sensor(sensor) for sensor in sensors]

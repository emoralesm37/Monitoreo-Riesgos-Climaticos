
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


def map_sensors_with_units(
    sensors: list[dict],
    sensor_types: list[dict],
) -> list[dict]:
    units_by_type = {
        sensor_type["sensorTypeId"]: sensor_type.get("unit")
        for sensor_type in sensor_types
    }

    mapped_sensors = map_sensors(sensors)

    for original, mapped in zip(sensors, mapped_sensors):
        sensor_type_id = original.get("sensorTypeId")
        unit = units_by_type.get(sensor_type_id)

        mapped["unit"] = (
            unit if unit else "No disponible"
        )

    return mapped_sensors


def enrich_sensors_with_communities(
    sensors: list[dict],
    communities: list[dict],
) -> list[dict]:
    communities_by_id = {
        community["communityId"]: community
        for community in communities
    }

    for sensor in sensors:
        community_id = sensor.get("community_id")
        community = communities_by_id.get(community_id)

        if community is not None:
            sensor["community_name"] = (
                community.get("name") or "No disponible"
            )
            sensor["location"] = (
                community.get("department") or "No disponible"
            )
        else:
            sensor["community_name"] = "No disponible"
            sensor["location"] = "No disponible"

    return sensors

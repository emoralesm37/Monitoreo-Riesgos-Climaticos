def map_community(community: dict) -> dict:
    latitude = community.get("latitude")
    longitude = community.get("longitude")

    if latitude is not None and longitude is not None:
        coordinates = f"{latitude}, {longitude}"
    else:
        coordinates = "No disponibles"

    return {
        "name": community.get("name", ""),
        "municipality": community.get("municipality", ""),
        "department": community.get("department", ""),
        "country": community.get("country", ""),
        "coordinates": coordinates,
        "status": (
            "Activo" if community.get("isActive") is True
            else "Inactivo" if community.get("isActive") is False
            else "No disponible"
        ),
        "sensor_count": community.get("sensorCount", 0),
    }


def map_communities(communities: list[dict]) -> list[dict]:
    return [map_community(community) for community in communities]
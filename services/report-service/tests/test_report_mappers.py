
import sys
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from app.community_mapper import map_communities
from app.sensor_mapper import map_sensors


def test_community_mapper():
    communities = [{
        "name": "Comunidad Central",
        "municipality": "Guatemala",
        "department": "Guatemala",
        "country": "Guatemala",
        "latitude": 14.6349,
        "longitude": -90.5069,
        "isActive": True,
        "sensorCount": 3,
    }]

    result = map_communities(communities)

    assert len(result) == 1
    assert result[0]["name"] == "Comunidad Central"
    assert result[0]["status"] == "Activo"
    assert result[0]["sensor_count"] == 3


def test_sensor_mapper():
    sensors = [{
        "sensorId": 1,
        "name": "Sensor de temperatura",
        "sensorType": "TEMP",
        "communityId": 1,
        "isActive": True,
        "lastValue": 0,
        "lastUpdatedAt": None,
        "createdAt": None,
    }]

    result = map_sensors(sensors)

    assert len(result) == 1
    assert result[0]["sensor_id"] == 1
    assert result[0]["status"] == "Activo"
    assert result[0]["last_value"] == 0
    assert result[0]["last_updated_at"] == "No disponible"


def test_sensor_without_readings():
    sensors = [{
        "sensorId": 2,
        "name": "Sensor de humedad",
        "sensorType": "HUM",
        "communityId": 1,
        "isActive": False,
        "lastValue": None,
        "lastUpdatedAt": None,
        "createdAt": None,
    }]

    result = map_sensors(sensors)

    assert result[0]["status"] == "Inactivo"
    assert result[0]["last_value"] == "Sin lecturas"


def test_empty_lists():
    assert map_communities([]) == []
    assert map_sensors([]) == []

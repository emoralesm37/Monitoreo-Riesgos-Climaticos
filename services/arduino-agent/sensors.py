"""Definiciones de sensores para el agente ClimateGuard."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SensorConfig:
    sensor_id: int | None
    sensor_type: str
    unit: str
    min_value: float
    max_value: float
    enabled: bool = True


SENSORS = [
    SensorConfig(
        sensor_id=1,
        sensor_type="TEMPERATURE",
        unit="°C",
        min_value=20.0,
        max_value=35.0,
    ),
    SensorConfig(
        sensor_id=None,
        sensor_type="HUMIDITY",
        unit="%",
        min_value=30.0,
        max_value=90.0,
    ),
    SensorConfig(
        sensor_id=None,
        sensor_type="RAINFALL",
        unit="mm",
        min_value=0.0,
        max_value=50.0,
    ),
    SensorConfig(
        sensor_id=None,
        sensor_type="WATER_LEVEL",
        unit="m",
        min_value=0.0,
        max_value=3.0,
    ),
    SensorConfig(
        sensor_id=None,
        sensor_type="WIND_SPEED",
        unit="km/h",
        min_value=0.0,
        max_value=80.0,
    ),
]

from datetime import datetime


def filter_readings(
    readings: list[dict],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[dict]:
    """Filtra lecturas por rango de fecha y hora."""

    if start_date and end_date and start_date > end_date:
        raise ValueError(
            "La fecha inicial no puede ser mayor que la final"
        )

    filtered = []

    for reading in readings:
        timestamp = datetime.fromisoformat(
            reading["timestamp"].replace("Z", "+00:00")
        )

        # Normalizar fechas para realizar comparaciones UTC.
        if timestamp.tzinfo is None:
            from datetime import timezone
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        if start_date is not None:
            start = start_date
            if start.tzinfo is None:
                from datetime import timezone
                start = start.replace(tzinfo=timezone.utc)

            if timestamp < start:
                continue

        if end_date is not None:
            end = end_date
            if end.tzinfo is None:
                from datetime import timezone
                end = end.replace(tzinfo=timezone.utc)

            if timestamp > end:
                continue

        filtered.append(reading)

    return filtered

def filter_sensors(
    sensors: list[dict],
    sensor_id: int | None = None,
    community_id: int | None = None,
    sensor_type_id: int | None = None,
) -> list[dict]:
    """Selecciona sensores según los filtros del reporte."""

    filtered = []

    for sensor in sensors:
        if (
            sensor_id is not None
            and sensor.get("sensorId") != sensor_id
        ):
            continue

        if (
            community_id is not None
            and sensor.get("communityId") != community_id
        ):
            continue

        if (
            sensor_type_id is not None
            and sensor.get("sensorTypeId") != sensor_type_id
        ):
            continue

        filtered.append(sensor)

    return filtered

def prepare_readings_for_pdf(
    readings: list[dict],
) -> list[dict]:
    """Prepara la fecha y hora de cada lectura para el PDF."""

    prepared = []

    for reading in readings:
        timestamp = datetime.fromisoformat(
            reading["timestamp"].replace("Z", "+00:00")
        )

        prepared.append({
            **reading,
            "date": timestamp.strftime("%d/%m/%Y"),
            "time": timestamp.strftime("%H:%M:%S"),
        })

    return prepared
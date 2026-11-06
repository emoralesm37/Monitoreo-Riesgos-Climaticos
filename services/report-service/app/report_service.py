from pathlib import Path

from app.models import ReportMetadata, ReportStatus, ReportType
from app.pdf_generator import generate_communities_pdf
from app.repository import (
    save_report_metadata,
    update_report_metadata,
)
from app.community_client import get_communities
from app.pdf_generator import generate_sensors_pdf
from app.sensor_client import get_sensors, get_sensor_types
from app.sensor_mapper import map_sensors_with_units
from app.community_client import get_communities_raw
from app.sensor_mapper import enrich_sensors_with_communities
from app.pdf_generator import generate_readings_pdf
from app.reading_status import classify_reading

def create_communities_report(
    communities: list[dict],
    user_id: str,
    parameters: dict | None = None
) -> tuple[str, Path]:

    report = ReportMetadata(
        report_type=ReportType.COMMUNITIES,
        user_id=user_id,
        parameters=parameters or {},
        status=ReportStatus.PENDING
    )

    report_id = save_report_metadata(report)
    pdf_path = None

    try:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.PROCESSING.value}
        )

        pdf_path = generate_communities_pdf(communities)

        updated = update_report_metadata(
            report_id,
            {
                "status": ReportStatus.COMPLETED.value,
                "file_name": pdf_path.name,
                "file_path": str(pdf_path.resolve())
            }
        )

        if not updated:
            raise RuntimeError(
                "No se pudo actualizar la metadata del reporte"
            )

        return report_id, pdf_path

    except Exception:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.FAILED.value}
        )

        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)

        raise

def create_communities_report_from_api(
    access_token: str,
    user_id: str,
    parameters: dict | None = None,
    ) -> tuple[str, Path]:
    """
    Consulta comunidades oficiales y genera su reporte PDF.
    """

    communities = get_communities(access_token)

    return create_communities_report(
        communities=communities,
        user_id=user_id,
        parameters=parameters,
    )


def create_sensors_report(
    sensors: list[dict],
    user_id: str,
    parameters: dict | None = None,
    ) -> tuple[str, Path]:

    report = ReportMetadata(
        report_type=ReportType.SENSORS,
        user_id=user_id,
        parameters=parameters or {},
        status=ReportStatus.PENDING,
    )

    report_id = save_report_metadata(report)
    pdf_path = None

    try:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.PROCESSING.value},
        )

        pdf_path = generate_sensors_pdf(sensors)

        updated = update_report_metadata(
            report_id,
            {
                "status": ReportStatus.COMPLETED.value,
                "file_name": pdf_path.name,
                "file_path": str(pdf_path.resolve()),
            },
        )

        if not updated:
            raise RuntimeError(
                "No se pudo actualizar la metadata del reporte"
            )

        return report_id, pdf_path

    except Exception:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.FAILED.value},
        )

        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)

        raise


def create_sensors_report_from_api(
    access_token: str,
    user_id: str,
    parameters: dict | None = None,
):
    sensors = get_sensors(access_token)
    sensor_types = get_sensor_types(access_token)
    communities = get_communities_raw(access_token)

    mapped_sensors = map_sensors_with_units(
        sensors,
        sensor_types,
    )

    enriched_sensors = enrich_sensors_with_communities(
        mapped_sensors,
        communities,
    )

    return create_sensors_report(
        sensors=enriched_sensors,
        user_id=user_id,
        parameters=parameters,
    )

def get_filtered_readings(
    access_token: str,
    sensor_id: int | None = None,
    community_id: int | None = None,
    sensor_type_id: int | None = None,
    start_date=None,
    end_date=None,
) -> list[dict]:
    """Obtiene las lecturas correspondientes a los filtros."""

    from app.reading_filters import filter_sensors, filter_readings
    from app.sensor_client import get_all_sensor_readings

    sensors = get_sensors(access_token)

    selected_sensors = filter_sensors(
        sensors,
        sensor_id=sensor_id,
        community_id=community_id,
        sensor_type_id=sensor_type_id,
    )

    all_readings = []

    for sensor in selected_sensors:
        readings = get_all_sensor_readings(
            access_token,
            sensor["sensorId"],
        )

        filtered = filter_readings(
            readings,
            start_date=start_date,
            end_date=end_date,
        )

        for reading in filtered:
            all_readings.append({
                **reading,
                "sensorName": sensor.get("name"),
                "sensorTypeId": sensor.get("sensorTypeId"),
                "communityId": sensor.get("communityId"),
            })

    return all_readings

def enrich_readings(
    readings: list[dict],
    sensors: list[dict],
    sensor_types: list[dict],
    communities: list[dict],
    rules: list[dict] | None = None,
) -> list[dict]:
    """Agrega nombres de comunidad y unidades a las lecturas."""

    mapped_sensors = map_sensors_with_units(
        sensors,
        sensor_types,
    )

    enriched_sensors = enrich_sensors_with_communities(
        mapped_sensors,
        communities,
    )

    sensors_by_id = {
        sensor["sensor_id"]: sensor
        for sensor in enriched_sensors
    }

    result = []

    for reading in readings:
        sensor = sensors_by_id.get(reading.get("sensorId"), {})

        sensor_type_id = reading.get("sensorTypeId")

        status = "No evaluado"

        if sensor_type_id is not None:
            status = classify_reading(
                value=reading["value"],
                sensor_type_id=int(sensor_type_id),
                rules=rules,
            )
        result.append({
            **reading,
            "sensorName": sensor.get("name", "No disponible"),
            "communityName": sensor.get(
                "community_name", "No disponible"
            ),
            "unit": sensor.get("unit", "No disponible"),
            "status": status,
        })

    return result

def create_readings_report(
    readings: list[dict],
    user_id: str,
    parameters: dict | None = None,
) -> tuple[str, Path]:
    """Genera el PDF de lecturas y registra su metadata."""

    report = ReportMetadata(
        report_type=ReportType.READINGS,
        user_id=user_id,
        parameters=parameters or {},
        status=ReportStatus.PENDING,
    )

    report_id = save_report_metadata(report)
    pdf_path = None

    try:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.PROCESSING.value},
        )

        pdf_path = generate_readings_pdf(readings)

        updated = update_report_metadata(
            report_id,
            {
                "status": ReportStatus.COMPLETED.value,
                "file_name": pdf_path.name,
                "file_path": str(pdf_path.resolve()),
            },
        )

        if not updated:
            raise RuntimeError(
                "No se pudo actualizar la metadata del reporte"
            )

        return report_id, pdf_path

    except Exception:
        update_report_metadata(
            report_id,
            {"status": ReportStatus.FAILED.value},
        )

        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)

        raise

def create_readings_report_from_api(
    access_token: str,
    user_id: str,
    sensor_id: int | None = None,
    community_id: int | None = None,
    sensor_type_id: int | None = None,
    start_date=None,
    end_date=None,
    rules: list[dict] | None = None,
):
    """Obtiene lecturas filtradas y genera el reporte PDF."""

    from app.reading_filters import prepare_readings_for_pdf

    readings = get_filtered_readings(
        access_token=access_token,
        sensor_id=sensor_id,
        community_id=community_id,
        sensor_type_id=sensor_type_id,
        start_date=start_date,
        end_date=end_date,
    )

    sensors = get_sensors(access_token)
    sensor_types = get_sensor_types(access_token)
    communities = get_communities_raw(access_token)

    enriched = enrich_readings(
        readings=readings,
        sensors=sensors,
        sensor_types=sensor_types,
        communities=communities,
        rules=rules,
    )

    prepared = prepare_readings_for_pdf(enriched)

    parameters = {
        "sensorId": sensor_id,
        "communityId": community_id,
        "sensorTypeId": sensor_type_id,
        "startDate": start_date.isoformat() if start_date else None,
        "endDate": end_date.isoformat() if end_date else None,
    }

    return create_readings_report(
        readings=prepared,
        user_id=user_id,
        parameters=parameters,
    )
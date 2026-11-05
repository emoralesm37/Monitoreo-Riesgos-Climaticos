from pathlib import Path

from app.models import ReportMetadata, ReportStatus, ReportType
from app.pdf_generator import generate_communities_pdf
from app.repository import (
    save_report_metadata,
    update_report_metadata,
)
from app.community_client import get_communities
from app.pdf_generator import generate_sensors_pdf
from app.sensor_client import get_sensors
from app.sensor_mapper import map_sensors

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
    ) -> tuple[str, Path]:
    """
    Consulta Sensor Service y genera el reporte PDF.
    """

    sensors = get_sensors(access_token)

    return create_sensors_report(
        sensors=map_sensors(sensors),
        user_id=user_id,
        parameters=parameters,
    )
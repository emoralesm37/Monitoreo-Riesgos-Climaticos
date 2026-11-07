from pathlib import Path

from app.models import ReportMetadata, ReportStatus, ReportType
from app.pdf_generator import generate_communities_pdf
from app.repository import (
    save_report_metadata,
    update_report_metadata,
)
from app.community_client import get_communities


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
# Selective RF-REP-02/03 integration: reuse Edwin's mappers/templates while
# adapting data collection to the local Gateway export contract.
def select_sensors(sensors, parameters):
    from app.reading_filters import filter_sensors
    selected = filter_sensors(sensors, sensor_id=parameters.get('sensorId'),
        community_id=parameters.get('communityId'), sensor_type_id=parameters.get('sensorTypeId'))
    if parameters.get('isActive') is not None:
        selected = [s for s in selected if s.get('isActive') == parameters['isActive']]
    return selected


def collect_report_rows(report_type, token, parameters):
    from app.sensor_client import get_sensors, get_sensor_types, get_communities_raw, get_all_sensor_readings, ReportLimitError
    from app.sensor_mapper import map_sensors_with_units, enrich_sensors_with_communities
    from app.reading_filters import prepare_readings_for_pdf
    sensors = select_sensors(get_sensors(token), parameters)
    mapped = enrich_sensors_with_communities(
        map_sensors_with_units(sensors, get_sensor_types(token)), get_communities_raw(token))
    if report_type == 'sensors':
        return mapped
    readings = []
    scanned = 0
    for sensor, display in zip(sensors, mapped):
        rows = get_all_sensor_readings(token, sensor['sensorId'], parameters, max_rows=20000 - scanned)
        scanned += len(rows)
        for row in rows:
            state = ('delivered' if row['evaluationDelivered'] else
                'pending' if row['evaluationRecorded'] else 'unrecorded')
            if parameters.get('evaluationStatus') and state != parameters['evaluationStatus']:
                continue
            readings.append({**row, 'sensorName': display['name'],
                'communityName': display['community_name'], 'unit': display['unit'],
                'status': {'delivered':'Evaluación entregada', 'pending':'Pendiente de evaluación',
                    'unrecorded':'Sin evaluación registrada'}[state]})
        if len(readings) > 20000:
            raise ReportLimitError('Reduce los filtros de lecturas.')
    readings.sort(key=lambda r: (r['timestamp'], r['sensorReadingId']))
    return prepare_readings_for_pdf(readings)


def create_data_report_from_api(report_type, access_token, user_id, parameters):
    from app.pdf_generator import generate_data_pdf
    report = ReportMetadata(report_type=ReportType(report_type), user_id=user_id,
        parameters=parameters, status=ReportStatus.PENDING)
    report_id = save_report_metadata(report)
    pdf_path = None
    try:
        if not update_report_metadata(report_id, {'status':ReportStatus.PROCESSING.value}):
            raise RuntimeError('No se pudo iniciar el reporte.')
        if report_type in ('sensors','readings'):
            rows = collect_report_rows(report_type, access_token, parameters)
            pdf_path = generate_data_pdf(report_type, rows, parameters)
        else:
            from app.extended_reports import collect
            from app.pdf_generator import generate_extended_pdf
            data = collect(report_type, access_token, parameters)
            rows = data['rows']
            pdf_path = generate_extended_pdf(report_type, data, parameters, user_id)
        if not update_report_metadata(report_id, {'status':ReportStatus.COMPLETED.value,
                'file_name':pdf_path.name, 'file_path':str(pdf_path.resolve()), 'row_count':len(rows)}):
            raise RuntimeError('No se pudo guardar el resultado del reporte.')
        return report_id, pdf_path, len(rows)
    except Exception:
        # Never remove a completed historical artifact or any pre-existing data.
        if pdf_path is not None:
            pdf_path.unlink(missing_ok=True)
        update_report_metadata(report_id, {'status':ReportStatus.FAILED.value})
        raise

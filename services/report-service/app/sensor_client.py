import httpx
from app.config import settings
import math

class SensorServiceError(Exception):
    pass

class ReportLimitError(Exception):
    pass

def fetch_json(access_token: str, path: str, params=None):
    # Only the configured internal Gateway is contacted; no client-supplied URLs.
    try:
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            response = client.get(settings.sensor_service_url.rstrip('/') + path,
                headers={'Authorization': 'Bearer ' + access_token}, params=params)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SensorServiceError('No se pudo consultar la fuente oficial.') from exc

def fetch_list(token: str, path: str):
    result = fetch_json(token, path)
    if not isinstance(result, list) or any(not isinstance(x, dict) for x in result):
        raise SensorServiceError('Contrato de lista no válido.')
    return result

def get_sensors(token):
    return fetch_list(token, '/api/sensors')

def get_sensor_types(token):
    return fetch_list(token, '/api/catalogs/sensor-types')

def get_communities_raw(token):
    return fetch_list(token, '/api/communities')

def get_all_sensor_readings(token, sensor_id, filters, max_rows=20000):
    result, after, snapshot = [], 0, None
    while True:
        params = {'pageSize': 500, 'afterId': after}
        if snapshot is not None:
            params['snapshotId'] = snapshot
        for key in ('startDate', 'endDate'):
            if filters.get(key):
                params[key] = filters[key]
        page = fetch_json(token, f'/api/sensors/{sensor_id}/readings/report', params)
        if (not isinstance(page, dict) or not isinstance(page.get('readings'), list)
                or type(page.get('snapshotId')) is not int
                or type(page.get('hasMore')) is not bool
                or type(page.get('nextAfterId')) is not int):
            raise SensorServiceError('Contrato de exportación no válido.')
        if snapshot is not None and page['snapshotId'] != snapshot:
            raise SensorServiceError('La instantánea de exportación cambió.')
        snapshot = page['snapshotId']
        rows = page['readings']
        previous = after
        for row in rows:
            if (not isinstance(row, dict) or type(row.get('sensorReadingId')) is not int
                    or row.get('sensorId') != sensor_id
                    or not after < row['sensorReadingId'] <= snapshot
                    or 'value' not in row or not isinstance(row.get('timestamp'), str)
                    or isinstance(row.get('value'), bool)
                    or not isinstance(row.get('value'), (int, float))
                    or not math.isfinite(row['value'])
                    or type(row.get('evaluationRecorded')) is not bool
                    or type(row.get('evaluationDelivered')) is not bool):
                raise SensorServiceError('Lectura oficial no válida.')
            after = row['sensorReadingId']
        if page['nextAfterId'] != after or (page['hasMore'] and after <= previous):
            raise SensorServiceError('La paginación no avanza.')
        result.extend(rows)
        if len(result) > max_rows:
            raise ReportLimitError('El reporte supera 20000 lecturas; reduce los filtros.')
        if not page['hasMore']:
            return result

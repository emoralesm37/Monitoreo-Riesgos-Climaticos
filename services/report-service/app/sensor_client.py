
import httpx

from app.config import settings


class SensorServiceError(Exception):
    """Error al consultar el servicio de sensores."""


def get_sensors(access_token: str) -> list[dict]:
    url = (
        f"{settings.sensor_service_url.rstrip('/')}"
        "/api/sensors"
    )

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

            response.raise_for_status()

            sensors = response.json()

            if not isinstance(sensors, list):
                raise SensorServiceError(
                    "La respuesta de sensores no tiene el formato esperado"
                )

            return sensors

    except httpx.HTTPStatusError as exc:
        raise SensorServiceError(
            f"El servicio de sensores respondió HTTP "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise SensorServiceError(
            "No fue posible conectar con el servicio de sensores"
        ) from exc

    except ValueError as exc:
        raise SensorServiceError(
            "El servicio de sensores devolvió un JSON inválido"
        ) from exc


def get_sensor_types(access_token: str) -> list[dict]:
    url = (
        f"{settings.sensor_service_url.rstrip('/')}"
        "/api/sensor-types"
    )

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
            )

            response.raise_for_status()

            sensor_types = response.json()

            if not isinstance(sensor_types, list):
                raise SensorServiceError(
                    "La respuesta de tipos de sensores "
                    "no tiene el formato esperado"
                )

            return sensor_types

    except httpx.HTTPStatusError as exc:
        raise SensorServiceError(
            f"El servicio de tipos de sensores respondió HTTP "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise SensorServiceError(
            "No fue posible conectar con el servicio "
            "de tipos de sensores"
        ) from exc

    except ValueError as exc:
        raise SensorServiceError(
            "El servicio de tipos de sensores "
            "devolvió un JSON inválido"
        ) from exc

def get_sensor_readings(
    access_token: str,
    sensor_id: int,
    page: int = 1,
    page_size: int = 100,
) -> dict:
    """Consulta una página de lecturas de un sensor."""

    if sensor_id <= 0:
        raise ValueError("El identificador del sensor debe ser positivo")

    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("Parámetros de paginación inválidos")

    url = (
        f"{settings.sensor_service_url.rstrip('/')}"
        f"/api/sensors/{sensor_id}/readings"
    )

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                },
                params={
                    "page": page,
                    "pageSize": page_size,
                },
            )

            response.raise_for_status()
            result = response.json()

            if (
                not isinstance(result, dict)
                or not isinstance(result.get("readings"), list)
                or not isinstance(result.get("totalPages"), int)
            ):
                raise SensorServiceError(
                    "La respuesta de lecturas no tiene "
                    "el formato esperado"
                )

            return result

    except httpx.HTTPStatusError as exc:
        raise SensorServiceError(
            "El servicio de lecturas respondió HTTP "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise SensorServiceError(
            "No fue posible conectar con el servicio de lecturas"
        ) from exc

    except ValueError as exc:
        raise SensorServiceError(
            "El servicio de lecturas devolvió un JSON inválido"
        ) from exc

def get_all_sensor_readings(
    access_token: str,
    sensor_id: int,
    max_pages: int = 10,
) -> list[dict]:
    """Recupera lecturas paginadas de un sensor."""

    if max_pages < 1:
        raise ValueError("max_pages debe ser mayor que cero")

    all_readings = []
    page = 1

    while page <= max_pages:
        result = get_sensor_readings(
            access_token=access_token,
            sensor_id=sensor_id,
            page=page,
            page_size=100,
        )

        readings = result["readings"]
        total_pages = result["totalPages"]

        all_readings.extend(readings)

        if page >= total_pages or not readings:
            return all_readings

        page += 1

    raise SensorServiceError(
        "Se alcanzó el límite de páginas de lecturas. "
        "No es posible garantizar un reporte completo."
    )
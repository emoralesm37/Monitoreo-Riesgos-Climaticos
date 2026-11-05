
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

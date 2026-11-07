"""Cliente HTTP para enviar mediciones a ClimateGuard Gateway."""

import json
import urllib.error
import urllib.request

from config import GATEWAY_URL


def send_reading(sensor_id, value, access_token):
    """Envía una medición a Sensor Service mediante Gateway."""

    if sensor_id is None or sensor_id <= 0:
        raise ValueError(
            "El sensor debe tener un identificador válido."
        )

    if not access_token:
        raise ValueError(
            "Se requiere un token JWT para enviar mediciones."
        )

    payload = json.dumps({
        "value": value
    }).encode("utf-8")

    request = urllib.request.Request(
        f"{GATEWAY_URL}/api/physical-sensors/{sensor_id}/readings",
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)

            return {
                "success": response.status == 201,
                "status": response.status,
                "sensor_id": sensor_id,
                "reading_id": result.get("sensorReadingId"),
                "value": result.get("value"),
                "timestamp": result.get("timestamp"),
            }

    except urllib.error.HTTPError as error:
        return {
            "success": False,
            "status": error.code,
            "sensor_id": sensor_id,
            "error": f"Gateway respondió HTTP {error.code}",
        }

    except urllib.error.URLError:
        return {
            "success": False,
            "status": None,
            "sensor_id": sensor_id,
            "error": "No fue posible conectar con Gateway.",
        }
